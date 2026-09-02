import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowRight,
  Barcode,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  LoaderCircle,
  PackageCheck,
  PackageX,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserRound,
  Wrench,
  X,
} from "lucide-react"

import { getCustomers } from "../../features/customers/customers.api"
import { getInventoryBatches, getInventorySerials } from "../../features/inventory/inventory.api"
import { getItems } from "../../features/items/items.api"
import { getSaleById, getSales } from "../../features/sales/sales.api"
import {
  createWarrantyClaim,
  dispatchToSupplier,
  getWarrantyClaimById,
  getWarrantyClaims,
  processImmediateReplacement,
  rejectCustomerClaim,
  releaseWarrantyClaim,
  resolveSupplierRma,
  updateWarrantyClaimStatus,
} from "../../features/warranty-claims/warrantyClaims.api"

const CREATE_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN", "CASHIER", "TECHNICIAN"])
const ACTION_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN", "CASHIER", "TECHNICIAN"])
const STATUSES = ["IN", "CHECKING", "SENT_TO_SUPPLIER", "APPROVED", "REJECTED", "REPAIRED", "REPLACED", "OUT"]
const NEXT_STATUSES = {
  IN: ["CHECKING"],
  CHECKING: ["SENT_TO_SUPPLIER", "APPROVED", "REJECTED", "REPAIRED"],
  SENT_TO_SUPPLIER: ["APPROVED", "REJECTED", "REPAIRED", "REPLACED"],
  APPROVED: ["REPAIRED", "REPLACED"],
  REJECTED: [],
  REPAIRED: [],
  REPLACED: [],
  OUT: [],
}
const RELEASE_READY = new Set(["REJECTED", "REPAIRED", "REPLACED"])
const FIELD_CLASS =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] hover:border-slate-300 placeholder:text-slate-400 placeholder:font-normal"

function dateTime(value) {
  if (!value) return "—"
  const valueDate = new Date(value)
  return Number.isNaN(valueDate.getTime()) ? "—" : valueDate.toLocaleString("en-PH")
}

function dateOnly(value) {
  if (!value) return "—"
  const valueDate = new Date(value)
  return Number.isNaN(valueDate.getTime()) ? "—" : valueDate.toLocaleDateString("en-PH")
}

function calculateAgingDays(dateValue) {
  if (!dateValue) return 0
  const start = new Date(dateValue).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)))
}

function apiError(error, fallback) {
  return error?.response?.data?.message || error?.response?.data?.error?.message || fallback
}

function formatStatus(status) {
  if (!status) return "—"
  return String(status)
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function statusTone(status) {
  if (status === "OUT") return "bg-slate-100 text-slate-700"
  if (["REPAIRED", "REPLACED", "APPROVED"].includes(status))
    return "bg-emerald-50 text-emerald-700 border border-emerald-200"
  if (status === "REJECTED") return "bg-rose-50 text-rose-700 border border-rose-200"
  if (status === "SENT_TO_SUPPLIER")
    return "bg-violet-50 text-violet-700 border border-violet-200"
  if (status === "CHECKING") return "bg-amber-50 text-amber-700 border border-amber-200"
  return "bg-sky-50 text-sky-700 border border-sky-200"
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(status)}`}>
      {formatStatus(status)}
    </span>
  )
}

function Modal({ children, onClose, title, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
      <section
        aria-label={title}
        aria-modal="true"
        className={`my-auto w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl ${
          wide ? "max-w-4xl" : "max-w-2xl"
        }`}
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
          <h2 className="text-base font-black text-slate-900 leading-tight">{title}</h2>
          <button
            aria-label="Close"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

function Field({ children, label, required = false }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
      {label} {required ? <span className="text-rose-600">*</span> : null}
      {children}
    </label>
  )
}

function unwrapList(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.data?.data)) return response.data.data
  if (Array.isArray(response?.data?.items)) return response.data.items
  if (Array.isArray(response?.items)) return response.items
  return []
}

const EMPTY_CREATE = {
  customerId: "",
  saleId: "",
  saleItemId: "",
  itemId: "",
  serialId: "",
  issueDescription: "",
  customerComplaint: "",
  diagnosis: "",
  actionTaken: "",
  supplierName: "",
  supplierReferenceNo: "",
  remarks: "",
}

export default function WarrantyPage({ selectedBranch, user }) {
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""
  const canCreate = CREATE_ROLES.has(user?.role)
  const canAct = ACTION_ROLES.has(user?.role)

  const [activeTab, setActiveTab] = useState("claims") // "claims", "supplier", "replaced_log"

  const [claims, setClaims] = useState([])
  const [meta, setMeta] = useState({})
  const [customers, setCustomers] = useState([])
  const [items, setItems] = useState([])
  const [sales, setSales] = useState([])
  const [selectedSale, setSelectedSale] = useState(null)
  const [saleSearchText, setSaleSearchText] = useState("")
  const [isSaleDropdownOpen, setIsSaleDropdownOpen] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isSaleLoading, setIsSaleLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [notice, setNotice] = useState("")

  // Create claim modal
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE)

  // Status Action Modal (Standard Lifecycle)
  const [actionStatus, setActionStatus] = useState("")
  const [actionForm, setActionForm] = useState({
    diagnosis: "",
    actionTaken: "",
    supplierName: "",
    supplierReferenceNo: "",
    remarks: "",
  })

  // Customer Claim Rejection Modal (Required remarks)
  const [showCustomerReject, setShowCustomerReject] = useState(false)
  const [customerRejectForm, setCustomerRejectForm] = useState({
    rejectionReason: "",
    remarks: "",
  })

  // Immediate Replacement Modal (Instant Swap with fresh warranty)
  const [showImmediateReplace, setShowImmediateReplace] = useState(false)
  const [replaceTargetClaim, setReplaceTargetClaim] = useState(null)
  const [replaceForm, setReplaceForm] = useState({
    replacementItemId: "",
    replacementBatchId: "",
    replacementSerialId: "",
    replacementSerialNumber: "",
    replacementWarrantyType: "MAJOR_PARTS",
    replacementWarrantyDuration: "12 Months Major Parts (7D Outright)",
    actionTaken: "",
    remarks: "",
  })
  const [availableReplacementBatches, setAvailableReplacementBatches] = useState([])
  const [availableReplacementSerials, setAvailableReplacementSerials] = useState([])
  const [isLoadingStock, setIsLoadingStock] = useState(false)

  // Dispatch to Supplier Modal
  const [showDispatchSupplier, setShowDispatchSupplier] = useState(false)
  const [dispatchTargetClaim, setDispatchTargetClaim] = useState(null)
  const [dispatchForm, setDispatchForm] = useState({
    supplierName: "",
    supplierReferenceNo: "",
    remarks: "",
  })

  // Supplier RMA Resolution Modal (Supplier Replaced vs Supplier Rejected Shrinkage)
  const [showResolveSupplier, setShowResolveSupplier] = useState(false)
  const [resolveTargetClaim, setResolveTargetClaim] = useState(null)
  const [resolveForm, setResolveForm] = useState({
    outcome: "REPLACED_BY_SUPPLIER", // "REPLACED_BY_SUPPLIER", "REPAIRED", "REJECTED"
    rejectionReason: "",
    actionTaken: "",
    remarks: "",
  })

  // Release Modal
  const [showRelease, setShowRelease] = useState(false)
  const [releaseForm, setReleaseForm] = useState({ actionTaken: "", remarks: "" })

  const loadClaims = useCallback(async () => {
    const response = await getWarrantyClaims({
      ...(branchId ? { branchId } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      page,
      limit: 50,
    })
    setClaims(Array.isArray(response?.data) ? response.data : [])
    setMeta(response?.meta || {})
  }, [branchId, page, search, statusFilter])

  const loadReferences = useCallback(async () => {
    if (!canCreate) return
    const branchParams = { ...(branchId ? { branchId } : {}), limit: 100 }
    const [customerResponse, itemResponse, saleResponse] = await Promise.all([
      getCustomers({ ...branchParams, status: "ACTIVE" }),
      getItems({ ...branchParams, status: "ACTIVE" }),
      getSales(branchParams),
    ])
    setCustomers(unwrapList(customerResponse))
    setItems(unwrapList(itemResponse))
    setSales(unwrapList(saleResponse).filter((sale) => sale.status !== "CANCELLED"))
  }, [branchId, canCreate])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      await Promise.all([loadClaims(), loadReferences()])
    } catch (error) {
      setErrorMessage(apiError(error, "Could not load warranty claims."))
    } finally {
      setIsLoading(false)
    }
  }, [loadClaims, loadReferences])

  useEffect(() => {
    const timer = window.setTimeout(refresh, 180)
    return () => window.clearTimeout(timer)
  }, [refresh])

  const openDetail = async (claim) => {
    setSelectedClaim(claim)
    setIsDetailLoading(true)
    setErrorMessage("")
    try {
      const response = await getWarrantyClaimById(claim.id)
      setSelectedClaim(response?.data || claim)
    } catch (error) {
      setErrorMessage(apiError(error, "Could not load warranty claim details."))
    } finally {
      setIsDetailLoading(false)
    }
  }

  const selectSale = async (saleId) => {
    setCreateForm((form) => ({ ...form, saleId, saleItemId: "", itemId: "", serialId: "" }))
    setSelectedSale(null)
    if (!saleId) return
    setIsSaleLoading(true)
    try {
      const response = await getSaleById(saleId)
      const sale = response?.data || null
      setSelectedSale(sale)
      setCreateForm((form) => ({ ...form, customerId: sale?.customer?.id || "" }))
    } catch (error) {
      setErrorMessage(apiError(error, "Could not load the selected sale."))
    } finally {
      setIsSaleLoading(false)
    }
  }

  const selectSaleItem = (saleItemId) => {
    const line = selectedSale?.items?.find((item) => item.id === saleItemId)
    setCreateForm((form) => ({
      ...form,
      saleItemId,
      itemId: line?.itemId || "",
      serialId: line?.serialId || "",
    }))
  }

  const submitCreate = async (event) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      const response = await createWarrantyClaim({
        ...(user?.role === "SUPER_OWNER" && branchId ? { branchId } : {}),
        customerId: createForm.customerId || undefined,
        saleId: createForm.saleId || undefined,
        saleItemId: createForm.saleItemId || undefined,
        serialId: createForm.serialId || undefined,
        ...(!createForm.saleItemId && createForm.itemId ? { itemId: createForm.itemId } : {}),
        issueDescription: createForm.issueDescription.trim(),
        customerComplaint: createForm.customerComplaint.trim() || undefined,
        diagnosis: createForm.diagnosis.trim() || undefined,
        actionTaken: createForm.actionTaken.trim() || undefined,
        supplierName: createForm.supplierName.trim() || undefined,
        supplierReferenceNo: createForm.supplierReferenceNo.trim() || undefined,
        remarks: createForm.remarks.trim() || undefined,
      })
      setCreateForm(EMPTY_CREATE)
      setSelectedSale(null)
      setShowCreate(false)
      setNotice(`✅ Warranty claim ${response?.data?.claimCode || ""} received successfully.`)
      setPage(1)
      await loadClaims()
    } catch (error) {
      setErrorMessage(apiError(error, "Could not create warranty claim."))
    } finally {
      setIsSaving(false)
    }
  }

  // Handle immediate swap initiation
  const openImmediateReplacementModal = async (claim) => {
    setReplaceTargetClaim(claim)
    const targetItemId = claim.itemId || claim.saleItem?.itemId || ""
    setReplaceForm({
      replacementItemId: targetItemId,
      replacementBatchId: "",
      replacementSerialId: "",
      replacementSerialNumber: "",
      replacementWarrantyType: "MAJOR_PARTS",
      replacementWarrantyDuration: "12 Months Major Parts (7D Outright)",
      actionTaken: `Customer received advance replacement unit.`,
      remarks: "",
    })
    setShowImmediateReplace(true)

    if (targetItemId && branchId) {
      setIsLoadingStock(true)
      try {
        const [batchRes, serialRes] = await Promise.all([
          getInventoryBatches({ branchId, itemId: targetItemId, status: "ACTIVE", limit: 100 }),
          getInventorySerials({ branchId, itemId: targetItemId, status: "AVAILABLE", limit: 100 }),
        ])
        setAvailableReplacementBatches(unwrapList(batchRes).filter((b) => Number(b.quantityAvailable || 0) > 0))
        setAvailableReplacementSerials(unwrapList(serialRes))
      } catch (err) {
        setErrorMessage("Unable to fetch available replacement stock.")
      } finally {
        setIsLoadingStock(false)
      }
    }
  }

  const handleReplacementItemChange = async (itemId) => {
    setReplaceForm((prev) => ({
      ...prev,
      replacementItemId: itemId,
      replacementBatchId: "",
      replacementSerialId: "",
      replacementSerialNumber: "",
    }))
    if (!itemId || !branchId) {
      setAvailableReplacementBatches([])
      setAvailableReplacementSerials([])
      return
    }

    setIsLoadingStock(true)
    try {
      const [batchRes, serialRes] = await Promise.all([
        getInventoryBatches({ branchId, itemId, status: "ACTIVE", limit: 100 }),
        getInventorySerials({ branchId, itemId, status: "AVAILABLE", limit: 100 }),
      ])
      setAvailableReplacementBatches(unwrapList(batchRes).filter((b) => Number(b.quantityAvailable || 0) > 0))
      setAvailableReplacementSerials(unwrapList(serialRes))
    } catch (err) {
      setErrorMessage("Unable to fetch replacement item stock.")
    } finally {
      setIsLoadingStock(false)
    }
  }

  const submitImmediateReplacement = async (event) => {
    event.preventDefault()
    if (!replaceTargetClaim || isSaving) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      const response = await processImmediateReplacement(replaceTargetClaim.id, {
        replacementItemId: replaceForm.replacementItemId || undefined,
        replacementBatchId: replaceForm.replacementBatchId || undefined,
        replacementSerialId: replaceForm.replacementSerialId || undefined,
        replacementSerialNumber: replaceForm.replacementSerialNumber || undefined,
        replacementWarrantyType: replaceForm.replacementWarrantyType,
        replacementWarrantyDuration: replaceForm.replacementWarrantyDuration,
        actionTaken: replaceForm.actionTaken.trim() || undefined,
        remarks: replaceForm.remarks.trim() || undefined,
      })
      setShowImmediateReplace(false)
      if (selectedClaim?.id === replaceTargetClaim.id) {
        setSelectedClaim(response?.data || replaceTargetClaim)
      }
      setNotice(
        `✅ Advance replacement issued for ${replaceTargetClaim.claimCode}. Branch inventory deducted (WARRANTY_OUT) and fresh warranty applied.`,
      )
      await loadClaims()
    } catch (error) {
      setErrorMessage(apiError(error, "Could not process immediate replacement."))
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Customer Claim Rejection (Void warranty)
  const openCustomerRejectModal = (claim) => {
    setSelectedClaim(claim)
    setCustomerRejectForm({
      rejectionReason: "",
      remarks: "",
    })
    setShowCustomerReject(true)
  }

  const submitCustomerReject = async (event) => {
    event.preventDefault()
    if (!selectedClaim || isSaving) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      const response = await rejectCustomerClaim(selectedClaim.id, {
        rejectionReason: customerRejectForm.rejectionReason.trim(),
        remarks: customerRejectForm.remarks.trim() || undefined,
      })
      setSelectedClaim(response?.data || selectedClaim)
      setShowCustomerReject(false)
      setNotice(`❌ Claim ${selectedClaim.claimCode} rejected with recorded remarks.`)
      await loadClaims()
    } catch (error) {
      setErrorMessage(apiError(error, "Could not reject warranty claim."))
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Dispatch to Supplier
  const openDispatchSupplierModal = (claim) => {
    setDispatchTargetClaim(claim)
    setDispatchForm({
      supplierName: claim.supplierName || "",
      supplierReferenceNo: claim.supplierReferenceNo || "",
      remarks: claim.remarks || "",
    })
    setShowDispatchSupplier(true)
  }

  const submitDispatchSupplier = async (event) => {
    event.preventDefault()
    if (!dispatchTargetClaim || isSaving) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      const response = await dispatchToSupplier(dispatchTargetClaim.id, {
        supplierName: dispatchForm.supplierName.trim(),
        supplierReferenceNo: dispatchForm.supplierReferenceNo.trim() || undefined,
        remarks: dispatchForm.remarks.trim() || undefined,
      })
      setShowDispatchSupplier(false)
      if (selectedClaim?.id === dispatchTargetClaim.id) {
        setSelectedClaim(response?.data || dispatchTargetClaim)
      }
      setNotice(`📦 Claim ${dispatchTargetClaim.claimCode} dispatched to ${dispatchForm.supplierName}.`)
      await loadClaims()
    } catch (error) {
      setErrorMessage(apiError(error, "Could not dispatch to supplier."))
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Supplier RMA Resolution (Supplier Replenished vs Supplier Rejected Shrinkage)
  const openResolveSupplierModal = (claim) => {
    setResolveTargetClaim(claim)
    setResolveForm({
      outcome: "REPLACED_BY_SUPPLIER",
      rejectionReason: "",
      actionTaken: "Supplier approved & replaced unit.",
      remarks: "",
    })
    setShowResolveSupplier(true)
  }

  const submitResolveSupplier = async (event) => {
    event.preventDefault()
    if (!resolveTargetClaim || isSaving) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      const response = await resolveSupplierRma(resolveTargetClaim.id, {
        outcome: resolveForm.outcome,
        rejectionReason: resolveForm.rejectionReason.trim() || undefined,
        actionTaken: resolveForm.actionTaken.trim() || undefined,
        remarks: resolveForm.remarks.trim() || undefined,
      })
      setShowResolveSupplier(false)
      if (selectedClaim?.id === resolveTargetClaim.id) {
        setSelectedClaim(response?.data || resolveTargetClaim)
      }
      const msg =
        resolveForm.outcome === "REJECTED"
          ? `⚠️ Supplier rejected RMA for ${resolveTargetClaim.claimCode}. Defective unit written off to Shrinkage Loss.`
          : `✅ Supplier resolved ${resolveTargetClaim.claimCode}. Unit received and replenished to stock (WARRANTY_RETURN).`
      setNotice(msg)
      await loadClaims()
    } catch (error) {
      setErrorMessage(apiError(error, "Could not resolve supplier RMA."))
    } finally {
      setIsSaving(false)
    }
  }

  const beginStatusAction = (status) => {
    setActionStatus(status)
    setActionForm({
      diagnosis: selectedClaim?.diagnosis || "",
      actionTaken: selectedClaim?.actionTaken || "",
      supplierName: selectedClaim?.supplierName || "",
      supplierReferenceNo: selectedClaim?.supplierReferenceNo || "",
      remarks: selectedClaim?.remarks || "",
    })
  }

  const submitStatus = async (event) => {
    event.preventDefault()
    if (!selectedClaim || !actionStatus || isSaving) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      const response = await updateWarrantyClaimStatus(selectedClaim.id, {
        status: actionStatus,
        diagnosis: actionForm.diagnosis.trim() || undefined,
        actionTaken: actionForm.actionTaken.trim() || undefined,
        supplierName: actionForm.supplierName.trim() || undefined,
        supplierReferenceNo: actionForm.supplierReferenceNo.trim() || undefined,
        remarks: actionForm.remarks.trim() || undefined,
      })
      setSelectedClaim(response?.data || selectedClaim)
      setActionStatus("")
      setNotice(`Claim ${selectedClaim.claimCode} moved to ${actionStatus.replaceAll("_", " ")}.`)
      await loadClaims()
    } catch (error) {
      setErrorMessage(apiError(error, "Could not update warranty status."))
    } finally {
      setIsSaving(false)
    }
  }

  const openRelease = () => {
    setReleaseForm({ actionTaken: selectedClaim?.actionTaken || "", remarks: selectedClaim?.remarks || "" })
    setShowRelease(true)
  }

  const submitRelease = async (event) => {
    event.preventDefault()
    if (!selectedClaim || isSaving) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      const response = await releaseWarrantyClaim(selectedClaim.id, {
        actionTaken: releaseForm.actionTaken.trim() || undefined,
        remarks: releaseForm.remarks.trim() || undefined,
      })
      setSelectedClaim(response?.data || selectedClaim)
      setShowRelease(false)
      setNotice(`✅ ${selectedClaim.claimCode} released to the customer.`)
      await loadClaims()
    } catch (error) {
      setErrorMessage(apiError(error, "Could not release warranty claim."))
    } finally {
      setIsSaving(false)
    }
  }

  // Filter subsets for tabs
  const activeClaims = useMemo(() => {
    return claims.filter((c) => ["IN", "CHECKING", "APPROVED", "REPAIRED", "REPLACED"].includes(c.status))
  }, [claims])

  const supplierClaims = useMemo(() => {
    return claims.filter((c) => c.status === "SENT_TO_SUPPLIER")
  }, [claims])

  const replacedAndShrinkageClaims = useMemo(() => {
    return claims.filter((c) => ["REPLACED", "REJECTED", "OUT"].includes(c.status))
  }, [claims])

  const pageSummary = useMemo(
    () => ({
      active: activeClaims.length,
      supplier: supplierClaims.length,
      readyRelease: claims.filter((c) => RELEASE_READY.has(c.status)).length,
      shrinkageOrReplaced: replacedAndShrinkageClaims.length,
    }),
    [activeClaims, supplierClaims, claims, replacedAndShrinkageClaims],
  )

  const totalPages = Math.max(1, meta.totalPages || 1)
  const selectedFormItem = items.find((item) => item.id === createForm.itemId)

  const filteredSales = useMemo(() => {
    const query = saleSearchText.trim().toLowerCase()
    if (!query) return sales.slice(0, 30)
    return sales
      .filter((s) => {
        return [s.receiptCode, s.customer?.fullName, s.customer?.customerCode, s.customer?.mobileNumber]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(query))
      })
      .slice(0, 30)
  }, [sales, saleSearchText])

  return (
    <div className="space-y-6">
      {/* Header & Metric Bar */}
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-maroon)]">
                Enterprise After-Sales & RMA
              </span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 dark:text-emerald-300">
                Anti-Fraud Shield Active
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">Warranty & RMA Operations</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">
              Immediate customer swaps with automatic stock deduction (<code className="text-xs font-mono font-bold">WARRANTY_OUT</code>), dedicated Supplier RMA aging, and auditable shrinkage tracking.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold hover:bg-[var(--color-soft)] transition shadow-xs"
              disabled={isLoading}
              onClick={refresh}
              type="button"
            >
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={16} /> Refresh
            </button>
            {canCreate ? (
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)]"
                onClick={() => setShowCreate(true)}
                type="button"
              >
                <Plus size={17} /> Receive customer claim
              </button>
            ) : null}
          </div>
        </div>

        {/* Quick Metric Cards */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div
            onClick={() => setActiveTab("claims")}
            className={`cursor-pointer rounded-2xl p-4 border transition ${
              activeTab === "claims"
                ? "border-[var(--color-maroon)] bg-[var(--color-soft)] shadow-xs"
                : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            <div className="flex items-center justify-between">
              <ShieldCheck className="text-[var(--color-maroon)]" size={20} />
              <span className="text-xs font-bold text-[var(--color-muted)]">Active Intake</span>
            </div>
            <p className="mt-3 text-2xl font-black text-[var(--color-text-strong)]">{pageSummary.active}</p>
            <p className="text-xs font-semibold text-[var(--color-muted)]">In-store checking & approvals</p>
          </div>

          <div
            onClick={() => setActiveTab("supplier")}
            className={`cursor-pointer rounded-2xl p-4 border transition ${
              activeTab === "supplier"
                ? "border-violet-500 bg-violet-500/10 shadow-xs"
                : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            <div className="flex items-center justify-between">
              <Truck className="text-violet-600" size={20} />
              <span className="text-xs font-bold text-violet-700 dark:text-violet-400">Supplier RMA</span>
            </div>
            <p className="mt-3 text-2xl font-black text-violet-900 dark:text-violet-200">{pageSummary.supplier}</p>
            <p className="text-xs font-semibold text-violet-700 dark:text-violet-400">Dispatched & aging with distributors</p>
          </div>

          <div
            onClick={() => setActiveTab("claims")}
            className="rounded-2xl p-4 border border-[var(--color-border)] bg-[var(--color-card)]"
          >
            <div className="flex items-center justify-between">
              <PackageCheck className="text-emerald-600" size={20} />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Ready to Release</span>
            </div>
            <p className="mt-3 text-2xl font-black text-emerald-800 dark:text-emerald-200">{pageSummary.readyRelease}</p>
            <p className="text-xs font-semibold text-[var(--color-muted)]">Repaired / Replaced for pickup</p>
          </div>

          <div
            onClick={() => setActiveTab("replaced_log")}
            className={`cursor-pointer rounded-2xl p-4 border transition ${
              activeTab === "replaced_log"
                ? "border-[var(--color-maroon)] bg-[var(--color-soft)] shadow-xs"
                : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            <div className="flex items-center justify-between">
              <PackageX className="text-amber-600" size={20} />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Replaced & Shrinkage</span>
            </div>
            <p className="mt-3 text-2xl font-black text-[var(--color-text-strong)]">{pageSummary.shrinkageOrReplaced}</p>
            <p className="text-xs font-semibold text-[var(--color-muted)]">Swaps & written-off loss records</p>
          </div>
        </div>
      </section>

      {/* Notice & Error Messages */}
      {notice ? (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-800 dark:text-emerald-300">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} type="button">
            <X size={16} />
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-800 dark:text-rose-300">
          <CircleAlert className="mt-0.5 shrink-0" size={17} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("claims")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${
            activeTab === "claims"
              ? "bg-[var(--color-maroon)] text-white shadow-soft"
              : "text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-text-strong)]"
          }`}
        >
          <ShieldCheck size={16} />
          <span>Active Claims & Quick Swaps ({activeClaims.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("supplier")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${
            activeTab === "supplier"
              ? "bg-violet-700 text-white shadow-soft"
              : "text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-text-strong)]"
          }`}
        >
          <Truck size={16} />
          <span>Sent to Supplier / RMA Hub ({supplierClaims.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("replaced_log")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${
            activeTab === "replaced_log"
              ? "bg-slate-800 dark:bg-slate-700 text-white shadow-soft"
              : "text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-text-strong)]"
          }`}
        >
          <Layers size={16} />
          <span>Replaced Items & Shrinkage Loss Audit</span>
        </button>
      </div>

      {/* TAB 1: ACTIVE CLAIMS & QUICK SWAPS */}
      {activeTab === "claims" && (
        <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-card sm:p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
            <label className="relative">
              <Search className="absolute left-3.5 top-3 text-[var(--color-muted)]" size={17} />
              <input
                aria-label="Search warranty claims"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[var(--color-maroon)]"
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search claim code, customer, serial, or issue..."
                value={search}
              />
            </label>
            <select
              aria-label="Filter warranty status"
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3.5 py-2.5 text-sm font-bold"
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
              value={statusFilter}
            >
              <option value="">All active statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="grid min-h-64 place-items-center">
              <LoaderCircle className="animate-spin text-[var(--color-maroon)]" size={32} />
            </div>
          ) : claims.length === 0 ? (
            <div className="grid min-h-64 place-items-center text-center">
              <div>
                <ShieldCheck className="mx-auto text-[var(--color-muted)]" size={40} />
                <p className="mt-3 font-black text-[var(--color-text-strong)]">No active warranty claims found</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">Adjust search filters or receive a new claim.</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {claims.map((claim) => (
                <div
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left transition hover:border-[var(--color-maroon)]/40 hover:shadow-sm"
                  key={claim.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="truncate text-sm font-black text-[var(--color-maroon)]">
                          {claim.claimCode}
                        </span>
                        {calculateAgingDays(claim.sale?.saleDate) <= 7 && claim.sale?.saleDate ? (
                          <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:text-emerald-300">
                            ⚡ Outright Replacement Eligible (7D)
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-1 line-clamp-2 font-black text-[var(--color-text-strong)]">
                        {claim.issueDescription}
                      </h3>
                    </div>
                    <StatusBadge status={claim.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-bold text-[var(--color-muted)]">Customer</p>
                      <p className="mt-1 truncate font-bold text-[var(--color-text-strong)]">
                        {claim.customer?.fullName || "Walk-in / unlinked"}
                      </p>
                    </div>
                    <div>
                      <p className="font-bold text-[var(--color-muted)]">Item</p>
                      <p className="mt-1 truncate font-bold text-[var(--color-text-strong)]">
                        {claim.item?.itemName || claim.saleItem?.itemNameSnapshot || "Unlinked item"}
                      </p>
                    </div>
                    <div>
                      <p className="font-bold text-[var(--color-muted)]">Serial Number</p>
                      <p className="mt-1 truncate font-bold font-mono text-[var(--color-text-strong)]">
                        {claim.serial?.serialNumber || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-bold text-[var(--color-muted)]">Received Date</p>
                      <p className="mt-1 font-bold">{dateTime(claim.receivedAt)}</p>
                    </div>
                  </div>

                  {/* Direct Action Toolbar */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
                    <button
                      type="button"
                      onClick={() => openDetail(claim)}
                      className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-strong)] hover:bg-[var(--color-soft)] transition"
                    >
                      View Details & Lifecycle
                    </button>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {canAct && !["REPLACED", "REJECTED", "OUT"].includes(claim.status) ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openImmediateReplacementModal(claim)}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-black text-white shadow-xs transition"
                          >
                            🔄 Immediate Swap
                          </button>

                          <button
                            type="button"
                            onClick={() => openDispatchSupplierModal(claim)}
                            className="rounded-xl bg-violet-700 hover:bg-violet-800 px-3 py-1.5 text-xs font-black text-white shadow-xs transition"
                          >
                            🚚 Send to Supplier
                          </button>

                          <button
                            type="button"
                            onClick={() => openCustomerRejectModal(claim)}
                            className="rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700 transition"
                          >
                            ❌ Reject Claim
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
            <p className="text-xs font-bold text-[var(--color-muted)]">
              {meta.total || claims.length} total claim(s)
            </p>
            <div className="flex items-center gap-2">
              <button
                aria-label="Previous page"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 text-[var(--color-text-strong)] disabled:opacity-40"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((value) => value - 1)}
                type="button"
              >
                <ChevronLeft size={17} />
              </button>
              <span className="text-xs font-black text-[var(--color-text-strong)]">
                {page} / {totalPages}
              </span>
              <button
                aria-label="Next page"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 text-[var(--color-text-strong)] disabled:opacity-40"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((value) => value + 1)}
                type="button"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: SENT TO SUPPLIER (SUPPLIER RMA HUB) */}
      {activeTab === "supplier" && (
        <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-black text-[var(--color-text-strong)]">Sent to Supplier (RMA Monitor)</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Items dispatched to distributors/suppliers awaiting repair or replenishment.
              </p>
            </div>
            <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 px-3 py-1 text-xs font-black text-violet-800 dark:text-violet-300">
              {supplierClaims.length} Active Supplier RMA(s)
            </span>
          </div>

          {supplierClaims.length === 0 ? (
            <div className="grid min-h-48 place-items-center text-center p-8">
              <div>
                <Truck className="mx-auto text-[var(--color-muted)]" size={36} />
                <p className="mt-2 font-black text-[var(--color-text-strong)]">No items currently with suppliers</p>
                <p className="text-xs text-[var(--color-muted)]">
                  Use "Send to Supplier" from active claims when sending defective units for RMA.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {supplierClaims.map((claim) => {
                const agingDays = calculateAgingDays(claim.sentToSupplierAt || claim.receivedAt)
                return (
                  <div
                    key={claim.id}
                    className="rounded-2xl border border-violet-200 dark:border-violet-900/40 bg-[var(--color-card)] p-4 shadow-xs"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-sm text-[var(--color-maroon)]">
                            {claim.claimCode}
                          </span>
                          <span className="rounded-md bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 text-xs font-black text-violet-800 dark:text-violet-300">
                            Distributor: {claim.supplierName || "Unspecified Supplier"}
                          </span>
                          {claim.supplierReferenceNo ? (
                            <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-mono text-[var(--color-text-strong)]">
                              RMA #{claim.supplierReferenceNo}
                            </span>
                          ) : null}
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-black ${
                              agingDays >= 14
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                : agingDays >= 7
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                            }`}
                          >
                            ⏱️ {agingDays} day(s) aging
                          </span>
                        </div>

                        <h3 className="mt-1 font-black text-[var(--color-text-strong)]">
                          {claim.item?.itemName || claim.saleItem?.itemNameSnapshot || claim.issueDescription}
                        </h3>
                        <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                          Serial: <span className="font-mono font-bold">{claim.serial?.serialNumber || "—"}</span> · Dispatched: {dateTime(claim.sentToSupplierAt || claim.receivedAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openResolveSupplierModal(claim)}
                          className="rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-xs font-black text-white shadow-soft transition"
                        >
                          📦 Receive Supplier Outcome
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: REPLACED ITEMS & SHRINKAGE LOSS LOG */}
      {activeTab === "replaced_log" && (
        <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-black text-[var(--color-text-strong)]">Replaced Items & Shrinkage Loss Ledger</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Permanent audit trail of customer replacement units (WARRANTY_OUT) and supplier rejected write-offs.
              </p>
            </div>
          </div>

          {replacedAndShrinkageClaims.length === 0 ? (
            <p className="p-8 text-center text-sm text-[var(--color-muted)] font-bold">
              No replacements or shrinkage losses recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                    <th className="py-3 px-3">Claim / Date</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Customer & Item</th>
                    <th className="py-3 px-3">Old Serial</th>
                    <th className="py-3 px-3">Resolution Details</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {replacedAndShrinkageClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-[var(--color-soft)]/50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-xs text-[var(--color-maroon)]">
                        <div>{claim.claimCode}</div>
                        <div className="text-[10px] font-normal text-[var(--color-muted)]">{dateOnly(claim.replacedAt || claim.rejectedAt || claim.createdAt)}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-xs">
                        {claim.status === "REPLACED" ? (
                          <span className="rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-black">
                            🔄 Replacement Unit Out
                          </span>
                        ) : claim.status === "REJECTED" ? (
                          <span className="rounded-md bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 px-2 py-0.5 text-[11px] font-black">
                            ❌ Rejected / Shrinkage Loss
                          </span>
                        ) : (
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-bold">
                            📦 {claim.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <div className="font-black text-[var(--color-text-strong)]">{claim.item?.itemName || claim.saleItem?.itemNameSnapshot}</div>
                        <div className="text-[11px] text-[var(--color-muted)]">{claim.customer?.fullName || "Walk-in"}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs font-bold">
                        {claim.serial?.serialNumber || "—"}
                      </td>
                      <td className="py-3 px-3 text-xs max-w-xs truncate text-[var(--color-text-strong)]">
                        {claim.actionTaken || claim.diagnosis || claim.remarks || "—"}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={claim.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* MODAL 1: RECEIVE NEW WARRANTY CLAIM (With Anti-Fraud Auto Check) */}
      {showCreate ? (
        <Modal
          onClose={() => {
            setShowCreate(false)
            setSaleSearchText("")
            setIsSaleDropdownOpen(false)
          }}
          title="Receive Customer Warranty Claim"
          wide
        >
          <form onSubmit={submitCreate}>
            <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5 sm:p-6">
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-800 dark:text-sky-300">
                <strong>Anti-Fraud Protection:</strong> Linking the original receipt auto-validates warranty period, customer eligibility, and ensures the same serial has not already been claimed.
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="block text-sm font-bold text-[var(--color-text-strong)]">
                  <span>Original Receipt / Sale (Recommended)</span>
                  {selectedSale ? (
                    <div className="mt-1.5 flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 shadow-xs">
                      <div>
                        <p className="font-black text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 size={15} className="text-emerald-600" />
                          <span>{selectedSale.receiptCode}</span>
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          {selectedSale.customer?.fullName || "Walk-in"} · {dateTime(selectedSale.saleDate)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-700 transition"
                        onClick={() => {
                          selectSale("")
                          setSaleSearchText("")
                        }}
                        title="Remove linked sale"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative mt-1.5">
                      <div className="relative">
                        <Search
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
                          size={16}
                        />
                        <input
                          type="text"
                          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] py-2.5 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-[var(--color-maroon)]/10"
                          placeholder="Scan receipt barcode or type receipt #..."
                          value={saleSearchText}
                          onFocus={() => setIsSaleDropdownOpen(true)}
                          onChange={(e) => {
                            setSaleSearchText(e.target.value)
                            setIsSaleDropdownOpen(true)
                          }}
                        />
                      </div>
                      {isSaleDropdownOpen && (
                        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl divide-y divide-[var(--color-border)]">
                          <button
                            type="button"
                            className="w-full p-2.5 text-left text-xs font-bold text-[var(--color-muted)] hover:bg-[var(--color-soft)] transition"
                            onClick={() => {
                              selectSale("")
                              setSaleSearchText("")
                              setIsSaleDropdownOpen(false)
                            }}
                          >
                            No linked receipt (Walk-in intake)
                          </button>
                          {filteredSales.map((sale) => (
                            <button
                              key={sale.id}
                              type="button"
                              className="w-full p-2.5 text-left hover:bg-[var(--color-soft)] transition flex items-center justify-between"
                              onClick={() => {
                                selectSale(sale.id)
                                setSaleSearchText("")
                                setIsSaleDropdownOpen(false)
                              }}
                            >
                              <div>
                                <p className="text-xs font-black text-[var(--color-text-strong)]">{sale.receiptCode}</p>
                                <p className="text-[11px] text-[var(--color-muted)] font-semibold">
                                  {sale.customer?.fullName || "Walk-in"} · {dateTime(sale.saleDate)}
                                </p>
                              </div>
                              <span className="text-[10px] font-bold text-[var(--color-maroon)] bg-[var(--color-maroon-soft)] px-2 py-0.5 rounded-md">
                                Select
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Field label="Sold Line Item (Select from Receipt)">
                  <select
                    className={FIELD_CLASS}
                    disabled={!selectedSale || isSaleLoading}
                    onChange={(event) => selectSaleItem(event.target.value)}
                    value={createForm.saleItemId}
                  >
                    <option value="">{isSaleLoading ? "Loading receipt items…" : "Select purchased line item"}</option>
                    {selectedSale?.items?.map((line) => (
                      <option key={line.id} value={line.id}>
                        Line {line.lineNo}: {line.itemNameSnapshot || line.description} {line.serialId ? " (Serialized)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Customer (Optional)">
                  <select
                    className={FIELD_CLASS}
                    disabled={Boolean(selectedSale?.customer)}
                    onChange={(event) => setCreateForm((form) => ({ ...form, customerId: event.target.value }))}
                    value={createForm.customerId}
                  >
                    <option value="">Walk-in / Unlinked customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.fullName}{customer.companyName ? ` (${customer.companyName})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Product Catalog Item">
                  <select
                    className={FIELD_CLASS}
                    disabled={Boolean(createForm.saleItemId)}
                    onChange={(event) => setCreateForm((form) => ({ ...form, itemId: event.target.value }))}
                    value={createForm.itemId}
                  >
                    <option value="">Select product</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.itemCode} · {item.itemName}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Issue Description" required>
                  <textarea
                    autoFocus
                    className={FIELD_CLASS}
                    onChange={(event) => setCreateForm((form) => ({ ...form, issueDescription: event.target.value }))}
                    placeholder="e.g. No display output, artifacts on boot..."
                    required
                    rows="3"
                    value={createForm.issueDescription}
                  />
                </Field>

                <Field label="Customer Complaint">
                  <textarea
                    className={FIELD_CLASS}
                    onChange={(event) => setCreateForm((form) => ({ ...form, customerComplaint: event.target.value }))}
                    placeholder="Customer's verbatim description of the issue"
                    rows="3"
                    value={createForm.customerComplaint}
                  />
                </Field>
              </div>

              <Field label="Staff Receiving Remarks">
                <textarea
                  className={FIELD_CLASS}
                  onChange={(event) => setCreateForm((form) => ({ ...form, remarks: event.target.value }))}
                  placeholder="Physical condition upon intake (scratches, accessories included, etc.)"
                  rows="2"
                  value={createForm.remarks}
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6">
              <button
                className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold hover:bg-[var(--color-soft)]"
                onClick={() => {
                  setShowCreate(false)
                  setSaleSearchText("")
                  setIsSaleDropdownOpen(false)
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-[var(--color-maroon-hover)]"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Receiving Claim…" : "Receive Claim"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* MODAL 2: IMMEDIATE REPLACEMENT / ADVANCE SWAP (With Fresh Warranty Selection) */}
      {showImmediateReplace && replaceTargetClaim ? (
        <Modal
          onClose={() => setShowImmediateReplace(false)}
          title={`Immediate Customer Swap: ${replaceTargetClaim.claimCode}`}
          wide
        >
          <form onSubmit={submitImmediateReplacement}>
            <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5 sm:p-6">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
                <strong>Instant Replacement Policy:</strong> Deducts 1 unit from active branch inventory via{" "}
                <code className="font-mono font-bold">WARRANTY_OUT</code> (zero fake sales revenue) and assigns a fresh warranty period to the new replacement serial.
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Replacement Item from Catalog" required>
                  <select
                    className={FIELD_CLASS}
                    value={replaceForm.replacementItemId}
                    onChange={(e) => handleReplacementItemChange(e.target.value)}
                    required
                  >
                    <option value="">Select replacement model</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.itemCode} · {it.itemName} {it.isSerialized ? "(Serialized)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                {availableReplacementSerials.length > 0 ? (
                  <Field label="Select Replacement Serial Number" required>
                    <select
                      className={FIELD_CLASS}
                      value={replaceForm.replacementSerialId}
                      onChange={(e) => {
                        const sId = e.target.value
                        const ser = availableReplacementSerials.find((s) => s.id === sId)
                        setReplaceForm((prev) => ({
                          ...prev,
                          replacementSerialId: sId,
                          replacementSerialNumber: ser?.serialNumber || "",
                          replacementBatchId: ser?.batchId || prev.replacementBatchId,
                        }))
                      }}
                      required
                    >
                      <option value="">Select available serial</option>
                      {availableReplacementSerials.map((ser) => (
                        <option key={ser.id} value={ser.id}>
                          {ser.serialNumber} (Batch: {ser.batch?.batchCode || "Active"})
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Select Replacement Stock Batch" required>
                    <select
                      className={FIELD_CLASS}
                      value={replaceForm.replacementBatchId}
                      onChange={(e) => setReplaceForm((prev) => ({ ...prev, replacementBatchId: e.target.value }))}
                      required
                    >
                      <option value="">Select active batch</option>
                      {availableReplacementBatches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.batchCode} · {Number(b.quantityAvailable || 0)} available
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              {/* Fresh Warranty Setup for the Replacement Unit */}
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)]/60 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-maroon)] flex items-center gap-1.5">
                    <ShieldCheck size={16} /> Fresh Warranty Coverage for Replacement Unit
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { label: "Major Parts (12 Mos)", type: "MAJOR_PARTS", duration: "12 Months Major Parts (7D Outright)" },
                      { label: "Accessories (30 Days)", type: "ACCESSORIES", duration: "30 Days (7D Outright)" },
                      { label: "Outright Only (7 Days)", type: "OUTRIGHT_ONLY", duration: "7 Days Outright Replacement" },
                    ].map((preset) => (
                      <button
                        key={preset.type}
                        type="button"
                        onClick={() =>
                          setReplaceForm((prev) => ({
                            ...prev,
                            replacementWarrantyType: preset.type,
                            replacementWarrantyDuration: preset.duration,
                          }))
                        }
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          replaceForm.replacementWarrantyType === preset.type
                            ? "bg-[var(--color-maroon)] text-white shadow-xs"
                            : "bg-white text-[var(--color-text-strong)] hover:bg-slate-100"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]"
                  placeholder="e.g. 12 Months Major Parts (7D Outright)"
                  value={replaceForm.replacementWarrantyDuration}
                  onChange={(e) => setReplaceForm((prev) => ({ ...prev, replacementWarrantyDuration: e.target.value }))}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Action Taken Summary">
                  <input
                    className={FIELD_CLASS}
                    value={replaceForm.actionTaken}
                    onChange={(e) => setReplaceForm((prev) => ({ ...prev, actionTaken: e.target.value }))}
                  />
                </Field>

                <Field label="Internal Remarks">
                  <input
                    className={FIELD_CLASS}
                    placeholder="Optional notes"
                    value={replaceForm.remarks}
                    onChange={(e) => setReplaceForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  />
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6">
              <button
                className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold"
                onClick={() => setShowImmediateReplace(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-soft transition"
                disabled={isSaving || isLoadingStock}
                type="submit"
              >
                {isSaving ? "Issuing Replacement…" : "Confirm Replacement & Deduct Stock"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* MODAL 3: DISPATCH TO SUPPLIER */}
      {showDispatchSupplier && dispatchTargetClaim ? (
        <Modal
          onClose={() => setShowDispatchSupplier(false)}
          title={`Dispatch to Supplier: ${dispatchTargetClaim.claimCode}`}
        >
          <form onSubmit={submitDispatchSupplier}>
            <div className="space-y-4 p-5 sm:p-6">
              <div className="rounded-2xl bg-[var(--color-soft)] p-4 text-sm text-[var(--color-muted)]">
                Defective item will be moved to <strong>SENT TO SUPPLIER</strong> status and monitored in the Supplier RMA Hub until repaired or replaced.
              </div>

              <Field label="Supplier / Distributor Name" required>
                <input
                  className={FIELD_CLASS}
                  placeholder="e.g. Asus Philippines, Ubertech, Iontech..."
                  required
                  value={dispatchForm.supplierName}
                  onChange={(e) => setDispatchForm((prev) => ({ ...prev, supplierName: e.target.value }))}
                />
              </Field>

              <Field label="Supplier RMA / Tracking Reference #">
                <input
                  className={FIELD_CLASS}
                  placeholder="e.g. RMA-2026-09823"
                  value={dispatchForm.supplierReferenceNo}
                  onChange={(e) => setDispatchForm((prev) => ({ ...prev, supplierReferenceNo: e.target.value }))}
                />
              </Field>

              <Field label="Dispatch Remarks">
                <textarea
                  className={FIELD_CLASS}
                  placeholder="Courier tracking, contact person, etc."
                  rows="2"
                  value={dispatchForm.remarks}
                  onChange={(e) => setDispatchForm((prev) => ({ ...prev, remarks: e.target.value }))}
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6">
              <button
                className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold"
                onClick={() => setShowDispatchSupplier(false)}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-xl bg-violet-700 hover:bg-violet-800 px-4 py-2.5 text-sm font-bold text-white shadow-soft"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Dispatching…" : "Confirm Supplier Dispatch"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* MODAL 4: SUPPLIER RMA RESOLUTION (Approved vs Rejected Shrinkage) */}
      {showResolveSupplier && resolveTargetClaim ? (
        <Modal
          onClose={() => setShowResolveSupplier(false)}
          title={`Resolve Supplier RMA: ${resolveTargetClaim.claimCode}`}
        >
          <form onSubmit={submitResolveSupplier}>
            <div className="space-y-4 p-5 sm:p-6">
              <Field label="Supplier Outcome" required>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { id: "REPLACED_BY_SUPPLIER", label: "✅ Replaced Unit Received" },
                    { id: "REPAIRED", label: "🔧 Repaired Unit Received" },
                    { id: "REJECTED", label: "❌ Supplier Rejected (Loss)" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setResolveForm((prev) => ({ ...prev, outcome: opt.id }))}
                      className={`rounded-xl p-3 text-xs font-black text-center transition border ${
                        resolveForm.outcome === opt.id
                          ? opt.id === "REJECTED"
                            ? "border-rose-600 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 shadow-xs"
                            : "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-xs"
                          : "border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-soft)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>

              {resolveForm.outcome === "REJECTED" ? (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-3">
                  <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
                    <strong>Inventory Shrinkage Write-off:</strong> The supplier rejected the claim. This unit will be permanently logged as a write-off / shrinkage loss.
                  </p>
                  <Field label="Mandatory Supplier Rejection Reason" required>
                    <textarea
                      required
                      className={FIELD_CLASS}
                      placeholder="e.g. Customer induced damage: Corroded contacts, PCB fracture voided warranty..."
                      rows="3"
                      value={resolveForm.rejectionReason}
                      onChange={(e) => setResolveForm((prev) => ({ ...prev, rejectionReason: e.target.value }))}
                    />
                  </Field>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <strong>Stock Replenishment:</strong> Receiving the repaired/replaced unit automatically replenishes 1 unit back into branch active inventory via <code className="font-mono">WARRANTY_RETURN</code>.
                  </p>
                </div>
              )}

              <Field label="Action Taken Notes">
                <textarea
                  className={FIELD_CLASS}
                  rows="2"
                  value={resolveForm.actionTaken}
                  onChange={(e) => setResolveForm((prev) => ({ ...prev, actionTaken: e.target.value }))}
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6">
              <button
                className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold"
                onClick={() => setShowResolveSupplier(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-soft transition ${
                  resolveForm.outcome === "REJECTED" ? "bg-rose-700 hover:bg-rose-800" : "bg-emerald-700 hover:bg-emerald-800"
                }`}
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Submitting Resolution…" : "Confirm Supplier Outcome"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* MODAL 5: CUSTOMER CLAIM REJECTION (With Required Remarks) */}
      {showCustomerReject && selectedClaim ? (
        <Modal
          onClose={() => setShowCustomerReject(false)}
          title={`Reject Customer Claim: ${selectedClaim.claimCode}`}
        >
          <form onSubmit={submitCustomerReject}>
            <div className="space-y-4 p-5 sm:p-6">
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">
                <strong>Permanent Rejection Record:</strong> Record the reason why the customer's warranty claim is denied (e.g. broken warranty sticker, physical damage, expired warranty). This prevents the customer from attempting to re-claim in another branch.
              </div>

              <Field label="Mandatory Rejection Reason" required>
                <textarea
                  autoFocus
                  required
                  className={FIELD_CLASS}
                  placeholder="e.g. Void sticker tampered, bent CPU socket pins, liquid damage found upon inspection..."
                  rows="3"
                  value={customerRejectForm.rejectionReason}
                  onChange={(e) => setCustomerRejectForm((prev) => ({ ...prev, rejectionReason: e.target.value }))}
                />
              </Field>

              <Field label="Additional Staff Remarks">
                <textarea
                  className={FIELD_CLASS}
                  placeholder="Optional details / customer interaction remarks"
                  rows="2"
                  value={customerRejectForm.remarks}
                  onChange={(e) => setCustomerRejectForm((prev) => ({ ...prev, remarks: e.target.value }))}
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6">
              <button
                className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold"
                onClick={() => setShowCustomerReject(false)}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-xl bg-rose-700 hover:bg-rose-800 px-4 py-2.5 text-sm font-bold text-white shadow-soft transition"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* MODAL 6: CLAIM DETAIL VIEW */}
      {selectedClaim ? (
        <Modal
          onClose={() => {
            setSelectedClaim(null)
            setActionStatus("")
            setShowRelease(false)
          }}
          title={selectedClaim.claimCode}
          wide
        >
          <div className="max-h-[78vh] overflow-y-auto p-5 sm:p-6">
            {isDetailLoading ? (
              <div className="grid min-h-48 place-items-center">
                <LoaderCircle className="animate-spin" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="max-w-3xl text-xl font-black">{selectedClaim.issueDescription}</h3>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      Received {dateTime(selectedClaim.receivedAt)} · {selectedClaim.branch?.name || selectedClaim.branch?.code}
                    </p>
                  </div>
                  <StatusBadge status={selectedClaim.status} />
                </div>

                <div className="grid gap-3 rounded-2xl bg-[var(--color-soft)] p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs font-bold text-[var(--color-muted)]">Customer</p>
                    <p className="mt-1 font-bold">{selectedClaim.customer?.fullName || "Walk-in / unlinked"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--color-muted)]">Item</p>
                    <p className="mt-1 font-bold">{selectedClaim.item?.itemName || selectedClaim.saleItem?.itemNameSnapshot || "Unlinked"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--color-muted)]">Serial</p>
                    <p className="mt-1 font-bold font-mono">{selectedClaim.serial?.serialNumber || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--color-muted)]">Original Sale</p>
                    <p className="mt-1 font-bold font-mono">{selectedClaim.sale?.receiptCode || "—"}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Customer complaint", selectedClaim.customerComplaint],
                    ["Diagnosis", selectedClaim.diagnosis],
                    ["Action taken", selectedClaim.actionTaken],
                    ["Supplier", selectedClaim.supplierName],
                    ["Supplier reference", selectedClaim.supplierReferenceNo],
                    ["Remarks", selectedClaim.remarks],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs font-black uppercase tracking-wide text-[var(--color-muted)]">{label}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{value || "—"}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--color-muted)]">Lifecycle Trail</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["Received", selectedClaim.receivedAt],
                      ["Checking", selectedClaim.checkingAt],
                      ["Sent to supplier", selectedClaim.sentToSupplierAt],
                      ["Approved", selectedClaim.approvedAt],
                      ["Rejected", selectedClaim.rejectedAt],
                      ["Repaired", selectedClaim.repairedAt],
                      ["Replaced", selectedClaim.replacedAt],
                      ["Released", selectedClaim.releasedAt],
                    ].map(([label, value]) => (
                      <div
                        className={`rounded-xl p-3 ${
                          value
                            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                            : "bg-[var(--color-soft)] text-[var(--color-muted)]"
                        }`}
                        key={label}
                      >
                        <p className="text-xs font-black">{label}</p>
                        <p className="mt-1 text-xs">{dateTime(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
                  {canAct && !["REPLACED", "REJECTED", "OUT"].includes(selectedClaim.status) ? (
                    <>
                      <button
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-soft transition"
                        onClick={() => openImmediateReplacementModal(selectedClaim)}
                        type="button"
                      >
                        🔄 Quick Swap / Immediate Replacement
                      </button>
                      <button
                        className="rounded-xl bg-violet-700 hover:bg-violet-800 px-4 py-2.5 text-sm font-bold text-white shadow-soft transition"
                        onClick={() => openDispatchSupplierModal(selectedClaim)}
                        type="button"
                      >
                        🚚 Send to Supplier
                      </button>
                      <button
                        className="rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-4 py-2.5 text-sm font-bold text-rose-700 transition"
                        onClick={() => openCustomerRejectModal(selectedClaim)}
                        type="button"
                      >
                        ❌ Reject Claim
                      </button>
                    </>
                  ) : null}

                  {canAct
                    ? NEXT_STATUSES[selectedClaim.status]?.map((status) => (
                        <button
                          className={
                            status === "REJECTED"
                              ? "rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700"
                              : "rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white"
                          }
                          key={status}
                          onClick={() => beginStatusAction(status)}
                          type="button"
                        >
                          Mark {formatStatus(status).toLowerCase()}
                        </button>
                      ))
                    : null}

                  {canAct && RELEASE_READY.has(selectedClaim.status) ? (
                    <button
                      className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-black text-white"
                      onClick={openRelease}
                      type="button"
                    >
                      <CheckCircle2 size={17} /> Release to customer
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {/* MODAL 7: LIFECYCLE STATUS MOVE */}
      {actionStatus ? (
        <Modal onClose={() => setActionStatus("")} title={`Move claim to ${formatStatus(actionStatus)}`}>
          <form onSubmit={submitStatus}>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5 sm:p-6">
              <div className="rounded-2xl bg-[var(--color-soft)] p-4 text-sm text-[var(--color-muted)]">
                This appends a timestamped lifecycle outcome and records the acting user. The original sale remains unchanged.
              </div>
              <Field label="Diagnosis">
                <textarea
                  className={FIELD_CLASS}
                  onChange={(event) => setActionForm((form) => ({ ...form, diagnosis: event.target.value }))}
                  rows="3"
                  value={actionForm.diagnosis}
                />
              </Field>
              <Field label="Action taken">
                <textarea
                  className={FIELD_CLASS}
                  onChange={(event) => setActionForm((form) => ({ ...form, actionTaken: event.target.value }))}
                  rows="3"
                  value={actionForm.actionTaken}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Supplier name">
                  <input
                    className={FIELD_CLASS}
                    onChange={(event) => setActionForm((form) => ({ ...form, supplierName: event.target.value }))}
                    value={actionForm.supplierName}
                  />
                </Field>
                <Field label="Supplier reference">
                  <input
                    className={FIELD_CLASS}
                    onChange={(event) => setActionForm((form) => ({ ...form, supplierReferenceNo: event.target.value }))}
                    value={actionForm.supplierReferenceNo}
                  />
                </Field>
              </div>
              <Field label="Remarks">
                <textarea
                  className={FIELD_CLASS}
                  onChange={(event) => setActionForm((form) => ({ ...form, remarks: event.target.value }))}
                  rows="2"
                  value={actionForm.remarks}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6">
              <button
                className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold"
                onClick={() => setActionStatus("")}
                type="button"
              >
                Back
              </button>
              <button
                className={
                  actionStatus === "REJECTED"
                    ? "rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white"
                    : "rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white"
                }
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Saving…" : "Confirm status"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* MODAL 8: RELEASE TO CUSTOMER */}
      {showRelease ? (
        <Modal onClose={() => setShowRelease(false)} title="Release warranty claim">
          <form onSubmit={submitRelease}>
            <div className="space-y-4 p-5 sm:p-6">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                <strong>Confirm physical release.</strong> This closes the claim as OUT and records who released it. It cannot be moved back into processing.
              </div>
              <Field label="Final action taken">
                <textarea
                  className={FIELD_CLASS}
                  onChange={(event) => setReleaseForm((form) => ({ ...form, actionTaken: event.target.value }))}
                  rows="3"
                  value={releaseForm.actionTaken}
                />
              </Field>
              <Field label="Release remarks">
                <textarea
                  className={FIELD_CLASS}
                  onChange={(event) => setReleaseForm((form) => ({ ...form, remarks: event.target.value }))}
                  rows="2"
                  value={releaseForm.remarks}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4 sm:px-6">
              <button
                className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold"
                onClick={() => setShowRelease(false)}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Releasing…" : "Confirm release"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}

