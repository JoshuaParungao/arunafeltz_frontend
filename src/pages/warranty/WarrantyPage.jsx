import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  Layers,
  LoaderCircle,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
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
  if (status === "OUT") return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
  if (["REPAIRED", "REPLACED", "APPROVED"].includes(status))
    return "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
  if (status === "REJECTED")
    return "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
  if (status === "SENT_TO_SUPPLIER")
    return "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800"
  if (status === "CHECKING")
    return "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
  return "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800"
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusTone(status)}`}>
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

export default function WarrantyPage({ initialContext, selectedBranch, user }) {
  const branchName = selectedBranch?.name || user?.branch?.name || "Selected Branch"
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
  const [search, setSearch] = useState(initialContext?.search || "")
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
    outcome: "REPLACED_BY_SUPPLIER",
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
      await createWarrantyClaim({
        branchId,
        customerId: createForm.customerId || undefined,
        saleId: createForm.saleId || undefined,
        saleItemId: createForm.saleItemId || undefined,
        itemId: createForm.itemId || undefined,
        serialId: createForm.serialId || undefined,
        issueDescription: createForm.issueDescription.trim(),
        customerComplaint: createForm.customerComplaint.trim() || undefined,
        diagnosis: createForm.diagnosis.trim() || undefined,
        actionTaken: createForm.actionTaken.trim() || undefined,
        supplierName: createForm.supplierName.trim() || undefined,
        supplierReferenceNo: createForm.supplierReferenceNo.trim() || undefined,
        remarks: createForm.remarks.trim() || undefined,
      })
      setShowCreate(false)
      setCreateForm(EMPTY_CREATE)
      setSelectedSale(null)
      setSaleSearchText("")
      setNotice("Customer warranty claim received successfully.")
      await loadClaims()
    } catch (error) {
      setErrorMessage(apiError(error, "Could not receive warranty claim."))
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Immediate Replacement Modal Trigger
  const openImmediateReplacementModal = async (claim) => {
    setReplaceTargetClaim(claim)
    const initialItemId = claim.itemId || claim.saleItem?.itemId || ""
    setReplaceForm({
      replacementItemId: initialItemId,
      replacementBatchId: "",
      replacementSerialId: "",
      replacementSerialNumber: "",
      replacementWarrantyType: "MAJOR_PARTS",
      replacementWarrantyDuration: "12 Months Major Parts (7D Outright)",
      actionTaken: "Immediate replacement unit issued.",
      remarks: "",
    })
    setShowImmediateReplace(true)

    if (initialItemId) {
      await loadStockForReplacement(initialItemId)
    }
  }

  const loadStockForReplacement = async (itemId) => {
    if (!itemId) {
      setAvailableReplacementBatches([])
      setAvailableReplacementSerials([])
      return
    }
    setIsLoadingStock(true)
    try {
      const [batchRes, serialRes] = await Promise.all([
        getInventoryBatches({ branchId, itemId, status: "ACTIVE" }),
        getInventorySerials({ branchId, itemId, status: "AVAILABLE" }),
      ])
      const batches = unwrapList(batchRes).filter((b) => Number(b.quantityAvailable || 0) > 0)
      const serials = unwrapList(serialRes)

      setAvailableReplacementBatches(batches)
      setAvailableReplacementSerials(serials)

      if (batches.length > 0 && !replaceForm.replacementBatchId) {
        setReplaceForm((prev) => ({ ...prev, replacementBatchId: batches[0].id }))
      }
    } catch (err) {
      console.warn("Failed to load replacement stock:", err)
    } finally {
      setIsLoadingStock(false)
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
    await loadStockForReplacement(itemId)
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
        replacementSerialNumber: replaceForm.replacementSerialNumber.trim() || undefined,
        replacementWarrantyType: replaceForm.replacementWarrantyType,
        replacementWarrantyDuration: replaceForm.replacementWarrantyDuration.trim(),
        actionTaken: replaceForm.actionTaken.trim() || undefined,
        remarks: replaceForm.remarks.trim() || undefined,
      })
      setShowImmediateReplace(false)
      if (selectedClaim?.id === replaceTargetClaim.id) {
        setSelectedClaim(response?.data || replaceTargetClaim)
      }
      setNotice(`✅ Replacement unit issued for ${replaceTargetClaim.claimCode}. Stock automatically deducted.`)
      await loadClaims()
    } catch (error) {
      setErrorMessage(apiError(error, "Could not process immediate replacement."))
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Customer Claim Rejection
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
      setShowCustomerReject(false)
      setSelectedClaim(response?.data || selectedClaim)
      setNotice(`⚠️ Claim ${selectedClaim.claimCode} marked as REJECTED.`)
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

  // Handle Supplier RMA Resolution
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
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-soft)]/40 to-[var(--color-card)] p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-[var(--color-maroon)]/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">
                Warranty & RMA
              </span>
              <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-[var(--color-text-strong)]">
                {branchName}
              </span>
            </div>
            <h1 className="mt-2.5 text-3xl font-black tracking-tight text-[var(--color-text-strong)]">
              Warranty & Claims Management
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Manage customer claims, instant replacement swaps, distributor RMA monitoring, and audited releases.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-3 text-sm font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)]"
              disabled={isLoading}
              onClick={refresh}
              type="button"
            >
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={16} />
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>

            {canCreate ? (
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)]"
                onClick={() => setShowCreate(true)}
                type="button"
              >
                <Plus size={16} />
                + Receive Customer Claim
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* Minimalist 4 Metrics Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          onClick={() => setActiveTab("claims")}
          className={`cursor-pointer rounded-3xl p-5 border transition shadow-card ${
            activeTab === "claims"
              ? "border-[var(--color-maroon)] bg-[var(--color-soft)]/50"
              : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border-strong)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <ShieldCheck size={20} />
            </span>
            <span className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">In Store</span>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-[var(--color-text-strong)]">{pageSummary.active}</p>
          <p className="mt-0.5 text-xs font-medium text-[var(--color-muted)]">Active In-Store Claims</p>
        </div>

        <div
          onClick={() => setActiveTab("supplier")}
          className={`cursor-pointer rounded-3xl p-5 border transition shadow-card ${
            activeTab === "supplier"
              ? "border-violet-500/50 bg-violet-500/10"
              : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border-strong)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              <Truck size={20} />
            </span>
            <span className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider">With Suppliers</span>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-[var(--color-text-strong)]">{pageSummary.supplier}</p>
          <p className="mt-0.5 text-xs font-medium text-[var(--color-muted)]">Dispatched for Supplier RMA</p>
        </div>

        <div
          onClick={() => setActiveTab("claims")}
          className="rounded-3xl p-5 border border-[var(--color-border)] bg-[var(--color-card)] shadow-card cursor-pointer hover:border-[var(--color-border-strong)] transition"
        >
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <PackageCheck size={20} />
            </span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Ready Pickup</span>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-[var(--color-text-strong)]">{pageSummary.readyRelease}</p>
          <p className="mt-0.5 text-xs font-medium text-[var(--color-muted)]">Repaired / Replaced for Release</p>
        </div>

        <div
          onClick={() => setActiveTab("replaced_log")}
          className={`cursor-pointer rounded-3xl p-5 border transition shadow-card ${
            activeTab === "replaced_log"
              ? "border-[var(--color-maroon)] bg-[var(--color-soft)]/50"
              : "border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border-strong)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <Layers size={20} />
            </span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Audit Log</span>
          </div>
          <p className="mt-3 font-mono text-2xl font-black text-[var(--color-text-strong)]">{pageSummary.shrinkageOrReplaced}</p>
          <p className="mt-0.5 text-xs font-medium text-[var(--color-muted)]">Swapped / Written-Off Units</p>
        </div>
      </div>

      {/* Global Notice Alert */}
      {notice ? (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} type="button">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Global Error Message */}
      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
          <CircleAlert className="mt-0.5 shrink-0" size={15} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {/* Minimalist Segmented Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("claims")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
            activeTab === "claims"
              ? "bg-[var(--color-maroon)] text-white shadow-soft"
              : "text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-text-strong)]"
          }`}
        >
          <ShieldCheck size={15} />
          <span>Active Claims ({activeClaims.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("supplier")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
            activeTab === "supplier"
              ? "bg-violet-700 text-white shadow-soft"
              : "text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-text-strong)]"
          }`}
        >
          <Truck size={15} />
          <span>Supplier RMA Hub ({supplierClaims.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("replaced_log")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
            activeTab === "replaced_log"
              ? "bg-slate-800 dark:bg-slate-700 text-white shadow-soft"
              : "text-[var(--color-muted)] hover:bg-[var(--color-soft)] hover:text-[var(--color-text-strong)]"
          }`}
        >
          <Layers size={15} />
          <span>Replacements & Shrinkage Ledger ({replacedAndShrinkageClaims.length})</span>
        </button>
      </div>

      {/* TAB 1: ACTIVE CLAIMS */}
      {activeTab === "claims" && (
        <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
          {/* Search & Filter Header */}
          <div className="grid gap-3 border-b border-[var(--color-border)] p-4 md:grid-cols-[1fr_240px]">
            <label className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={16} />
              <input
                aria-label="Search warranty claims"
                className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-3 pl-10 pr-4 text-sm text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
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
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
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
            <div className="p-12 text-center text-sm font-semibold text-[var(--color-muted)]">
              <LoaderCircle className="mx-auto mb-2 animate-spin text-[var(--color-maroon)]" size={24} />
              Loading claims...
            </div>
          ) : claims.length === 0 ? (
            <div className="p-12 text-center text-sm font-semibold text-[var(--color-muted)]">
              No warranty claims found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-[var(--color-soft)] text-xs font-black uppercase tracking-wider text-[var(--color-muted)]">
                  <tr>
                    <th className="px-5 py-4">Claim No.</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Product & Serial</th>
                    <th className="px-5 py-4">Reported Issue</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Received Date</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {claims.map((claim) => {
                    const isOutright = calculateAgingDays(claim.sale?.saleDate) <= 7 && claim.sale?.saleDate
                    return (
                      <tr className="transition hover:bg-[var(--color-soft)]/50" key={claim.id}>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => openDetail(claim)}
                            className="font-mono font-bold text-sm text-[var(--color-maroon)] hover:underline text-left block"
                          >
                            {claim.claimCode}
                          </button>
                          {isOutright ? (
                            <span className="inline-block mt-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 text-[9px] font-black">
                              ⚡ 7D Outright
                            </span>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-sm text-[var(--color-text-strong)]">
                            {claim.customer?.fullName || "Walk-in Customer"}
                          </p>
                          {claim.customer?.mobileNumber ? (
                            <p className="text-xs text-[var(--color-muted)]">{claim.customer.mobileNumber}</p>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-xs text-[var(--color-text-strong)] max-w-xs truncate">
                            {claim.item?.itemName || claim.saleItem?.itemNameSnapshot || "Unlinked Product"}
                          </p>
                          <p className="mt-0.5 text-xs font-mono text-[var(--color-muted)]">
                            S/N: <strong>{claim.serial?.serialNumber || "No serial"}</strong>
                          </p>
                        </td>
                        <td className="px-5 py-4 text-xs text-[var(--color-muted)] max-w-xs">
                          <p className="line-clamp-2">{claim.issueDescription || "—"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={claim.status} />
                        </td>
                        <td className="px-5 py-4 text-xs text-[var(--color-muted)]">
                          {dateOnly(claim.receivedAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => openDetail(claim)}
                              className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)]"
                            >
                              <Eye size={13} />
                              <span>Details</span>
                            </button>

                            {canAct && !["REPLACED", "REJECTED", "OUT"].includes(claim.status) ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openImmediateReplacementModal(claim)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition"
                                  title="Issue immediate replacement unit"
                                >
                                  <span>Swap</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openDispatchSupplierModal(claim)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-violet-700 hover:bg-violet-800 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition"
                                  title="Dispatch to supplier for RMA"
                                >
                                  <span>Supplier</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openCustomerRejectModal(claim)}
                                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700 transition"
                                  title="Reject claim with remarks"
                                >
                                  <span>Reject</span>
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Minimalist Pagination */}
          <div className="flex items-center justify-between border-t border-[var(--color-border)] p-4">
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
                <ChevronLeft size={16} />
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
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: SENT TO SUPPLIER (SUPPLIER RMA HUB) */}
      {activeTab === "supplier" && (
        <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
          <div className="border-b border-[var(--color-border)] p-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[var(--color-text-strong)]">Supplier RMA Monitoring Hub</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Units dispatched to distributors and suppliers awaiting replacement or repair outcome.
              </p>
            </div>
            <span className="rounded-full bg-violet-100 dark:bg-violet-950/60 px-3 py-1 text-xs font-black text-violet-800 dark:text-violet-300">
              {supplierClaims.length} Active RMA(s)
            </span>
          </div>

          {supplierClaims.length === 0 ? (
            <div className="p-12 text-center text-sm font-semibold text-[var(--color-muted)]">
              <Truck className="mx-auto mb-2 text-[var(--color-muted)]" size={32} />
              No claims currently aging with suppliers.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {supplierClaims.map((claim) => {
                const agingDays = calculateAgingDays(claim.sentToSupplierAt || claim.receivedAt)
                return (
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:bg-[var(--color-soft)]/40" key={claim.id}>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-sm text-[var(--color-maroon)]">
                          {claim.claimCode}
                        </span>
                        <span className="rounded-md bg-violet-100 dark:bg-violet-950/60 px-2 py-0.5 text-xs font-bold text-violet-800 dark:text-violet-300">
                          {claim.supplierName || "Unspecified Supplier"}
                        </span>
                        {claim.supplierReferenceNo ? (
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-mono text-[var(--color-text-strong)]">
                            Ref: {claim.supplierReferenceNo}
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

                      <h3 className="mt-1 font-black text-sm text-[var(--color-text-strong)]">
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
                        Receive Supplier Outcome
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: REPLACED ITEMS & SHRINKAGE LOSS LEDGER */}
      {activeTab === "replaced_log" && (
        <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
          <div className="border-b border-[var(--color-border)] p-5">
            <h2 className="text-lg font-black text-[var(--color-text-strong)]">Replacements & Shrinkage Loss Ledger</h2>
            <p className="text-xs text-[var(--color-muted)]">
              Audit ledger of replacement units issued from stock (<code className="font-mono">WARRANTY_OUT</code>) and supplier write-offs.
            </p>
          </div>

          {replacedAndShrinkageClaims.length === 0 ? (
            <div className="p-12 text-center text-sm font-semibold text-[var(--color-muted)]">
              No replacements or shrinkage losses recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-[var(--color-soft)] text-xs font-black uppercase tracking-wider text-[var(--color-muted)]">
                  <tr>
                    <th className="px-5 py-4">Claim / Date</th>
                    <th className="px-5 py-4">Classification</th>
                    <th className="px-5 py-4">Customer & Product</th>
                    <th className="px-5 py-4">Original Serial</th>
                    <th className="px-5 py-4">Resolution Notes</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {replacedAndShrinkageClaims.map((claim) => (
                    <tr className="hover:bg-[var(--color-soft)]/50 transition" key={claim.id}>
                      <td className="px-5 py-4 font-mono font-bold text-xs text-[var(--color-maroon)]">
                        <div>{claim.claimCode}</div>
                        <div className="text-[10px] font-normal text-[var(--color-muted)]">{dateOnly(claim.replacedAt || claim.rejectedAt || claim.createdAt)}</div>
                      </td>
                      <td className="px-5 py-4">
                        {claim.status === "REPLACED" ? (
                          <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-xs font-black">
                            🔄 Replacement Unit Out
                          </span>
                        ) : claim.status === "REJECTED" ? (
                          <span className="rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 px-2 py-0.5 text-xs font-black">
                            ❌ Shrinkage Loss Write-Off
                          </span>
                        ) : (
                          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-bold">
                            {claim.status}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <p className="font-bold text-[var(--color-text-strong)]">{claim.item?.itemName || claim.saleItem?.itemNameSnapshot}</p>
                        <p className="text-[11px] text-[var(--color-muted)]">{claim.customer?.fullName || "Walk-in"}</p>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-bold text-[var(--color-text-strong)]">
                        {claim.serial?.serialNumber || "—"}
                      </td>
                      <td className="px-5 py-4 text-xs text-[var(--color-muted)] max-w-xs truncate">
                        {claim.actionTaken || claim.diagnosis || claim.remarks || "—"}
                      </td>
                      <td className="px-5 py-4">
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

      {/* MODAL 1: RECEIVE NEW WARRANTY CLAIM */}
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
            <div className="max-h-[72vh] space-y-4 overflow-y-auto p-5 sm:p-6 text-xs">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="block text-xs font-bold text-[var(--color-text-strong)]">
                  <span>Original Receipt / Sale Link (Optional)</span>
                  {selectedSale ? (
                    <div className="mt-1.5 flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 shadow-2xs">
                      <div>
                        <p className="font-black text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span>{selectedSale.receiptCode}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                          {selectedSale.customer?.fullName || "Walk-in"} · {dateTime(selectedSale.saleDate)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-700 transition"
                        onClick={() => {
                          selectSale("")
                          setSaleSearchText("")
                        }}
                        title="Remove linked sale"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative mt-1.5">
                      <div className="relative">
                        <Search
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
                          size={15}
                        />
                        <input
                          type="text"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs outline-none transition focus:bg-white focus:border-[var(--color-maroon)]"
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
                        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl divide-y divide-slate-100">
                          <button
                            type="button"
                            className="w-full p-2.5 text-left text-xs font-bold text-slate-500 hover:bg-slate-50 transition"
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
                              className="w-full p-2.5 text-left hover:bg-slate-50 transition flex items-center justify-between"
                              onClick={() => {
                                selectSale(sale.id)
                                setSaleSearchText("")
                                setIsSaleDropdownOpen(false)
                              }}
                            >
                              <div>
                                <p className="text-xs font-bold text-slate-900">{sale.receiptCode}</p>
                                <p className="text-[11px] text-slate-400">
                                  {sale.customer?.fullName || "Walk-in"} · {dateTime(sale.saleDate)}
                                </p>
                              </div>
                              <span className="text-[10px] font-bold text-[var(--color-maroon)] bg-rose-50 px-2 py-0.5 rounded-md">
                                Select
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Field label="Purchased Item from Receipt">
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

            <div className="flex justify-end gap-2 border-t border-slate-200 p-4 sm:px-6">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
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
                className="rounded-xl bg-[var(--color-maroon)] px-5 py-2.5 text-xs font-bold text-white shadow-soft hover:bg-[var(--color-maroon-hover)]"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Receiving Claim…" : "Receive Claim"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* MODAL 2: IMMEDIATE REPLACEMENT / ADVANCE SWAP */}
      {showImmediateReplace && replaceTargetClaim ? (
        <Modal
          onClose={() => setShowImmediateReplace(false)}
          title={`Immediate Customer Swap: ${replaceTargetClaim.claimCode}`}
          wide
        >
          <form onSubmit={submitImmediateReplacement}>
            <div className="max-h-[72vh] space-y-4 overflow-y-auto p-5 sm:p-6 text-xs">
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5 text-emerald-900">
                <strong>Instant Swap Policy:</strong> Deducts 1 unit from active branch inventory via <code className="font-mono font-bold">WARRANTY_OUT</code> and sets fresh warranty coverage for the replacement unit.
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Replacement Model from Catalog" required>
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

              {/* Fresh Warranty Coverage */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/75 p-3.5 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck size={15} /> Fresh Warranty Coverage
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {[
                      { label: "12 Mos Major Parts", type: "MAJOR_PARTS", duration: "12 Months Major Parts (7D Outright)" },
                      { label: "30 Days Accessories", type: "ACCESSORIES", duration: "30 Days (7D Outright)" },
                      { label: "7 Days Outright", type: "OUTRIGHT_ONLY", duration: "7 Days Outright Replacement" },
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
                            ? "bg-[var(--color-maroon)] text-white shadow-2xs"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold outline-none focus:border-[var(--color-maroon)]"
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

            <div className="flex justify-end gap-2 border-t border-slate-200 p-4 sm:px-6">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => setShowImmediateReplace(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-soft transition"
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
            <div className="space-y-4 p-5 sm:p-6 text-xs">
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-slate-600">
                Item status will be set to <strong>SENT TO SUPPLIER</strong> and monitored in the Supplier RMA Hub.
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

            <div className="flex justify-end gap-2 border-t border-slate-200 p-4 sm:px-6">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => setShowDispatchSupplier(false)}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-xl bg-violet-700 hover:bg-violet-800 px-5 py-2.5 text-xs font-bold text-white shadow-soft"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? "Dispatching…" : "Confirm Supplier Dispatch"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* MODAL 4: SUPPLIER RMA RESOLUTION */}
      {showResolveSupplier && resolveTargetClaim ? (
        <Modal
          onClose={() => setShowResolveSupplier(false)}
          title={`Resolve Supplier RMA: ${resolveTargetClaim.claimCode}`}
        >
          <form onSubmit={submitResolveSupplier}>
            <div className="space-y-4 p-5 sm:p-6 text-xs">
              <Field label="Supplier Outcome" required>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { id: "REPLACED_BY_SUPPLIER", label: "✅ Replaced Unit" },
                    { id: "REPAIRED", label: "🔧 Repaired Unit" },
                    { id: "REJECTED", label: "❌ Supplier Rejected" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setResolveForm((prev) => ({ ...prev, outcome: opt.id }))}
                      className={`rounded-xl p-3 text-xs font-black text-center transition border ${
                        resolveForm.outcome === opt.id
                          ? opt.id === "REJECTED"
                            ? "border-rose-600 bg-rose-50 text-rose-800 shadow-2xs"
                            : "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-2xs"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>

              {resolveForm.outcome === "REJECTED" ? (
                <div className="rounded-2xl border border-rose-300 bg-rose-50 p-3.5 space-y-2">
                  <p className="text-xs font-bold text-rose-900">
                    <strong>Inventory Shrinkage Loss:</strong> The supplier rejected the claim. This unit will be logged as a write-off / shrinkage loss.
                  </p>
                  <Field label="Mandatory Supplier Rejection Reason" required>
                    <textarea
                      required
                      className={FIELD_CLASS}
                      placeholder="e.g. Customer induced damage: Corroded contacts, PCB fracture..."
                      rows="3"
                      value={resolveForm.rejectionReason}
                      onChange={(e) => setResolveForm((prev) => ({ ...prev, rejectionReason: e.target.value }))}
                    />
                  </Field>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5">
                  <p className="text-xs font-bold text-emerald-900">
                    <strong>Stock Replenishment:</strong> Receiving the repaired/replaced unit automatically replenishes 1 unit back into branch stock via <code className="font-mono">WARRANTY_RETURN</code>.
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

            <div className="flex justify-end gap-2 border-t border-slate-200 p-4 sm:px-6">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => setShowResolveSupplier(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={`rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-soft transition ${
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

      {/* MODAL 5: CUSTOMER CLAIM REJECTION */}
      {showCustomerReject && selectedClaim ? (
        <Modal
          onClose={() => setShowCustomerReject(false)}
          title={`Reject Customer Claim: ${selectedClaim.claimCode}`}
        >
          <form onSubmit={submitCustomerReject}>
            <div className="space-y-4 p-5 sm:p-6 text-xs">
              <div className="rounded-2xl border border-rose-300 bg-rose-50 p-3.5 text-rose-900">
                Record the official reason for denial (e.g. broken warranty seal, physical damage, expired warranty).
              </div>

              <Field label="Mandatory Rejection Reason" required>
                <textarea
                  autoFocus
                  required
                  className={FIELD_CLASS}
                  placeholder="e.g. Void sticker tampered, bent CPU socket pins, liquid damage found..."
                  rows="3"
                  value={customerRejectForm.rejectionReason}
                  onChange={(e) => setCustomerRejectForm((prev) => ({ ...prev, rejectionReason: e.target.value }))}
                />
              </Field>

              <Field label="Additional Staff Remarks">
                <textarea
                  className={FIELD_CLASS}
                  placeholder="Optional customer interaction remarks"
                  rows="2"
                  value={customerRejectForm.remarks}
                  onChange={(e) => setCustomerRejectForm((prev) => ({ ...prev, remarks: e.target.value }))}
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-4 sm:px-6">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => setShowCustomerReject(false)}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-xl bg-rose-700 hover:bg-rose-800 px-5 py-2.5 text-xs font-bold text-white shadow-soft transition"
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
          <div className="max-h-[78vh] overflow-y-auto p-5 sm:p-6 text-xs">
            {isDetailLoading ? (
              <div className="grid min-h-48 place-items-center">
                <LoaderCircle className="animate-spin text-[var(--color-maroon)]" size={24} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="max-w-3xl text-lg font-black text-slate-900">{selectedClaim.issueDescription}</h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Received {dateTime(selectedClaim.receivedAt)} · {selectedClaim.branch?.name || selectedClaim.branch?.code}
                    </p>
                  </div>
                  <StatusBadge status={selectedClaim.status} />
                </div>

                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/75 p-3.5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Customer</p>
                    <p className="mt-0.5 font-bold text-slate-900">{selectedClaim.customer?.fullName || "Walk-in"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Item</p>
                    <p className="mt-0.5 font-bold text-slate-900 truncate">{selectedClaim.item?.itemName || selectedClaim.saleItem?.itemNameSnapshot || "Unlinked"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Serial</p>
                    <p className="mt-0.5 font-bold font-mono text-slate-900">{selectedClaim.serial?.serialNumber || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Original Sale</p>
                    <p className="mt-0.5 font-bold font-mono text-slate-900">{selectedClaim.sale?.receiptCode || "—"}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Customer complaint", selectedClaim.customerComplaint],
                    ["Diagnosis", selectedClaim.diagnosis],
                    ["Action taken", selectedClaim.actionTaken],
                    ["Supplier", selectedClaim.supplierName],
                    ["Supplier reference", selectedClaim.supplierReferenceNo],
                    ["Remarks", selectedClaim.remarks],
                  ].map(([label, value]) => (
                    <div className="rounded-xl border border-slate-100 bg-white p-2.5" key={label}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-800">{value || "—"}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lifecycle Trail</p>
                  <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
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
                        className={`rounded-xl p-2.5 ${
                          value
                            ? "border border-emerald-300 bg-emerald-50 text-emerald-900"
                            : "border border-slate-100 bg-slate-50 text-slate-400"
                        }`}
                        key={label}
                      >
                        <p className="text-[10px] font-bold uppercase">{label}</p>
                        <p className="mt-0.5 text-[11px] font-mono">{dateTime(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3.5">
                  {canAct && !["REPLACED", "REJECTED", "OUT"].includes(selectedClaim.status) ? (
                    <>
                      <button
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-soft transition"
                        onClick={() => openImmediateReplacementModal(selectedClaim)}
                        type="button"
                      >
                        🔄 Quick Swap
                      </button>
                      <button
                        className="rounded-xl bg-violet-700 hover:bg-violet-800 px-4 py-2 text-xs font-bold text-white shadow-soft transition"
                        onClick={() => openDispatchSupplierModal(selectedClaim)}
                        type="button"
                      >
                        🚚 Send to Supplier
                      </button>
                      <button
                        className="rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-4 py-2 text-xs font-bold text-rose-700 transition"
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
                              ? "rounded-xl border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700"
                              : "rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-bold text-white"
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
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-bold text-white"
                      onClick={openRelease}
                      type="button"
                    >
                      <CheckCircle2 size={15} /> Release to customer
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
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5 sm:p-6 text-xs">
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
              <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="flex justify-end gap-2 border-t border-slate-200 p-4 sm:px-6">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => setActionStatus("")}
                type="button"
              >
                Back
              </button>
              <button
                className={
                  actionStatus === "REJECTED"
                    ? "rounded-xl bg-rose-700 px-5 py-2.5 text-xs font-bold text-white"
                    : "rounded-xl bg-[var(--color-maroon)] px-5 py-2.5 text-xs font-bold text-white"
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
            <div className="space-y-3 p-5 sm:p-6 text-xs">
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <strong>Confirm physical release:</strong> Closes the claim as OUT and records acting user.
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
            <div className="flex justify-end gap-2 border-t border-slate-200 p-4 sm:px-6">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => setShowRelease(false)}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-xl bg-[var(--color-maroon)] px-5 py-2.5 text-xs font-bold text-white"
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
