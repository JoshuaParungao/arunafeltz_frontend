import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Barcode,
  Calendar,
  CircleAlert,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  PackageSearch,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  User,
  UserRound,
  Wrench,
  X,
} from "lucide-react"

import {
  createQuotation,
  getQuotationById,
  getQuotations,
  getQuotationServiceStaff,
  updateQuotationStatus,
} from "../../features/quotations/quotations.api"
import { getItems } from "../../features/items/items.api"
import { createCustomer, getCustomers } from "../../features/customers/customers.api"
import { getInstallmentBasisSettings } from "../../features/settings/settings.api"
import { serializeQuotationNotes } from "../../utils/quotationSettlement"
import { parseItemWarranty } from "../items/ItemsPage"
import QuotationDetailDialog from "../../components/quotations/QuotationDetailDialog"

const DEFAULT_INSTALLMENT_BASIS = {
  MONTH_3: 1.06,
  MONTH_6: 1.12,
  MONTH_9: 1.18,
  MONTH_12: 1.24,
  MONTH_18: 1.36,
  MONTH_24: 1.48,
}

const INSTALLMENT_TERMS = [
  ["MONTH_3", "3 Months"],
  ["MONTH_6", "6 Months"],
  ["MONTH_9", "9 Months"],
  ["MONTH_12", "12 Months"],
  ["MONTH_18", "18 Months"],
  ["MONTH_24", "24 Months"],
]

function money(value) {
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
    month: "short",
    day: "numeric",
  })
}

function getQuotationRows(response) {
  const result = response?.data ?? response ?? {}
  if (Array.isArray(result)) return result
  if (Array.isArray(result.items)) return result.items
  if (Array.isArray(result.data)) return result.data
  if (Array.isArray(result.records)) return result.records
  if (Array.isArray(result.quotations)) return result.quotations
  return []
}

function getCatalogRows(response) {
  const payload = response?.data ?? response ?? {}
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.data)) return payload.data
  return []
}

function getItemCount(quotation) {
  if (Number.isFinite(quotation?.itemCount)) return quotation.itemCount
  if (Number.isFinite(quotation?.totalItems)) return quotation.totalItems
  if (Array.isArray(quotation?.items)) return quotation.items.length
  return 0
}

function formatStatusBadge(status) {
  const upper = String(status || "").toUpperCase()
  if (upper === "CONVERTED") {
    return {
      label: "CONVERTED TO SALE",
      className: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
    }
  }
  if (upper === "CANCELLED" || upper === "REJECTED") {
    return {
      label: "CANCELLED",
      className: "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800",
    }
  }
  return {
    label: "QUOTED",
    className: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800",
  }
}

function availablePriceTiers(item) {
  if (!item) return [1]
  const tiers = []
  for (let i = 1; i <= 5; i += 1) {
    if (Number(item[`price${i}`] || 0) > 0) {
      tiers.push(i)
    }
  }
  return tiers.length > 0 ? tiers : [1]
}

function defaultPriceTier(item) {
  const tiers = availablePriceTiers(item)
  return tiers[0] || 1
}

function getServiceMarkupAdjustedPrice(baseUnitPrice, markupPercent) {
  const base = Number(baseUnitPrice || 0)
  const markup = Number(markupPercent || 0)
  if (!Number.isFinite(base) || base <= 0) return 0
  if (!Number.isFinite(markup) || markup <= 0) return base
  if (markup >= 100) return base
  return Number((base / (1 - markup / 100)).toFixed(2))
}

function getLineUnitPrice(line) {
  if (line.type === "SERVICE") {
    return getServiceMarkupAdjustedPrice(line.baseUnitPrice, line.markupPercent)
  }
  const tier = Number(line.priceTier || 1)
  const basePrice = Number(line.item?.[`price${tier}`] || 0)
  const markup = Number(line.markupPercent || 0)
  if (!Number.isFinite(markup) || markup <= 0 || markup >= 100) return basePrice
  return Number((basePrice / (1 - markup / 100)).toFixed(2))
}

function getLineGross(line) {
  const qty = Number(line.quantity || 0)
  const unitPrice = getLineUnitPrice(line)
  return qty * unitPrice
}

function getLineTotal(line) {
  const gross = getLineGross(line)
  const discount = Number(line.discountAmount || 0)
  return Math.max(gross - discount, 0)
}

function getRoleLabel(role) {
  if (!role) return ""
  return role.replace(/_/g, " ")
}

export default function QuotationsPage({ selectedBranch, user }) {
  const branchName = selectedBranch?.name || user?.branch?.name || "Selected Branch"
  const branchId = selectedBranch?.id || user?.branch?.id || user?.branchId || ""

  // Main Page View Mode: "HISTORY" or "BUILDER"
  const [viewMode, setViewMode] = useState("HISTORY") // "HISTORY" | "BUILDER"

  // Quotation History State
  const [quotations, setQuotations] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedQuotation, setSelectedQuotation] = useState(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false)

  // -------------------------------------------------------------
  // POS-STYLE QUOTATION BUILDER STATE
  // -------------------------------------------------------------
  const [cart, setCart] = useState([])
  const [itemSearch, setItemSearch] = useState("")
  const [itemResults, setItemResults] = useState([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [itemMessage, setItemMessage] = useState("")
  const itemRequestIdRef = useRef(0)

  const [selectedPriceTier, setSelectedPriceTier] = useState(1)
  const [isPcBuild, setIsPcBuild] = useState(false)
  const [remarks, setRemarks] = useState("")

  // Customer Management
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false)
  const customerDropdownRef = useRef(null)
  const customerInputRef = useRef(null)

  // Service Performer / Staff
  const [serviceStaffList, setServiceStaffList] = useState([])
  const [selectedServiceStaffId, setSelectedServiceStaffId] = useState("")
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [serviceDescription, setServiceDescription] = useState("")
  const [serviceQuantity, setServiceQuantity] = useState("1")
  const [serviceUnitPrice, setServiceUnitPrice] = useState("")
  const [serviceMarkup, setServiceMarkup] = useState("")
  const [serviceDiscount, setServiceDiscount] = useState("0")

  // Financing / Installment Calculation
  const [installmentRates, setInstallmentRates] = useState(DEFAULT_INSTALLMENT_BASIS)
  const [showFinancingCalc, setShowFinancingCalc] = useState(false)
  const [selectedTerm, setSelectedTerm] = useState("MONTH_3")

  // Builder Execution State
  const [isCreatingQuotation, setIsCreatingQuotation] = useState(false)
  const [builderMessage, setBuilderMessage] = useState("")
  const [noticeMessage, setNoticeMessage] = useState("")
  const [activeQuotationDoc, setActiveQuotationDoc] = useState(null)
  const [isQuotationDocOpen, setIsQuotationDocOpen] = useState(false)
  const [isQuotationPreviewMode, setIsQuotationPreviewMode] = useState(false)

  // Load Quotation History
  const loadQuotations = useCallback(async () => {
    setIsLoading(true)
    setMessage("")
    try {
      const params = branchId ? { branchId, limit: 100 } : { limit: 100 }
      const response = await getQuotations(params)
      const rows = getQuotationRows(response)
      setQuotations(rows)
      if (rows.length === 0) {
        setMessage("No quotations recorded yet for this branch.")
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        "Could not load quotations."
      setQuotations([])
      setMessage(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    loadQuotations()
  }, [loadQuotations])

  // Load Installment Rates
  useEffect(() => {
    let isMounted = true
    getInstallmentBasisSettings()
      .then((res) => {
        if (isMounted && res?.data?.termBasis) {
          setInstallmentRates(res.data.termBasis)
        }
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [])

  // Load Customers
  const loadCustomers = useCallback(async () => {
    if (!branchId) return
    try {
      const response = await getCustomers({
        branchId,
        status: "ACTIVE",
        limit: 100,
      })
      const rows = Array.isArray(response?.data) ? response.data : []
      setCustomers(rows)
    } catch {
      // ignore
    }
  }, [branchId])

  // Load Service Staff
  const loadServiceStaff = useCallback(async () => {
    if (!branchId) return
    try {
      const response = await getQuotationServiceStaff({ branchId })
      const rows = Array.isArray(response?.data) ? response.data : []
      setServiceStaffList(rows)
    } catch {
      // ignore
    }
  }, [branchId])

  useEffect(() => {
    if (viewMode === "BUILDER") {
      loadCustomers()
      loadServiceStaff()
    }
  }, [viewMode, loadCustomers, loadServiceStaff])

  // Load Products for Builder Search
  const loadItems = useCallback(async () => {
    if (!branchId) {
      setItemResults([])
      return
    }

    const requestId = itemRequestIdRef.current + 1
    itemRequestIdRef.current = requestId
    setIsLoadingItems(true)
    setItemMessage("")

    try {
      const trimmedSearch = itemSearch.trim()
      const response = await getItems({
        branchId,
        status: "ACTIVE",
        search: trimmedSearch || undefined,
        page: 1,
        limit: 20,
      })

      if (requestId !== itemRequestIdRef.current) return

      const rows = getCatalogRows(response)
      setItemResults(rows)

      if (rows.length === 0 && trimmedSearch) {
        setItemMessage("No active products match this search.")
      }
    } catch (error) {
      if (requestId !== itemRequestIdRef.current) return
      setItemResults([])
      setItemMessage(error?.response?.data?.message || "Unable to search products right now.")
    } finally {
      if (requestId === itemRequestIdRef.current) setIsLoadingItems(false)
    }
  }, [branchId, itemSearch])

  useEffect(() => {
    if (viewMode === "BUILDER") {
      const timer = window.setTimeout(loadItems, itemSearch.trim() ? 250 : 0)
      return () => {
        window.clearTimeout(timer)
        itemRequestIdRef.current += 1
      }
    }
  }, [loadItems, itemSearch, viewMode])

  // Customer dropdown click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setIsCustomerDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Filtered Quotation Records
  const filteredQuotations = useMemo(() => {
    let list = quotations

    if (statusFilter === "QUOTED") {
      list = list.filter((q) => q.status === "DRAFT" || q.status === "APPROVED" || q.status === "QUOTED")
    } else if (statusFilter === "CONVERTED") {
      list = list.filter((q) => q.status === "CONVERTED")
    } else if (statusFilter === "CANCELLED") {
      list = list.filter((q) => q.status === "CANCELLED")
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((item) => {
        const code = String(item.quotationCode || "").toLowerCase()
        const customer = String(item.customer?.fullName || item.customerName || "").toLowerCase()
        const prepared = String(item.preparedBy?.fullName || item.preparedByName || "").toLowerCase()
        return code.includes(q) || customer.includes(q) || prepared.includes(q)
      })
    }

    return list
  }, [quotations, statusFilter, searchQuery])

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalQuotedAmount = 0
    let quotedCount = 0
    let convertedCount = 0

    quotations.forEach((q) => {
      const amt = Number(q.grandTotal || q.totalAmount || 0)
      if (q.status === "DRAFT" || q.status === "APPROVED" || q.status === "QUOTED") {
        totalQuotedAmount += amt
        quotedCount += 1
      } else if (q.status === "CONVERTED") {
        convertedCount += 1
      }
    })

    return {
      totalCount: quotations.length,
      totalQuotedAmount,
      quotedCount,
      convertedCount,
    }
  }, [quotations])

  // Quotation Cart Totals
  const totals = useMemo(() => {
    let productGross = 0
    let serviceGross = 0
    let totalDiscount = 0

    for (const line of cart) {
      const gross = getLineGross(line)
      const discount = Number(line.discountAmount || 0)

      if (line.type === "PRODUCT") {
        productGross += gross
      } else {
        serviceGross += gross
      }
      totalDiscount += discount
    }

    const subtotal = productGross + serviceGross
    const grandTotal = Math.max(subtotal - totalDiscount, 0)

    return {
      productGross,
      serviceGross,
      totalDiscount,
      grandTotal,
    }
  }, [cart])

  // Financing calculation
  const installmentCalculation = useMemo(() => {
    if (!showFinancingCalc || totals.grandTotal <= 0) return null
    const basisRate = installmentRates?.[selectedTerm] ?? DEFAULT_INSTALLMENT_BASIS[selectedTerm] ?? 1.0
    const months = Number(selectedTerm.replace("MONTH_", "")) || 3
    const financedTotal = Number((totals.grandTotal * basisRate).toFixed(2))
    const interestAmount = Number((financedTotal - totals.grandTotal).toFixed(2))
    const monthlyDue = Number((financedTotal / months).toFixed(2))

    return {
      term: selectedTerm,
      months,
      rate: basisRate,
      regularPriceTotalAmount: financedTotal,
      interestAmount,
      monthlyDueAmount: monthlyDue,
    }
  }, [showFinancingCalc, totals.grandTotal, selectedTerm, installmentRates])

  // Builder Methods
  const addProductToCart = (item) => {
    if (!item) return
    const activeCustomer = customers.find((c) => c.id === selectedCustomerId)
    const itemTiers = availablePriceTiers(item)
    const targetTier = (activeCustomer?.priceTier ? Number(activeCustomer.priceTier) : null) || selectedPriceTier
    const chosenTier = targetTier && itemTiers.includes(targetTier) ? targetTier : defaultPriceTier(item)

    setCart((current) => [
      ...current,
      {
        localId: `product-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "PRODUCT",
        item,
        itemId: item.id,
        priceTier: chosenTier,
        quantity: "1",
        markupPercent: "",
        discountAmount: "0",
        warrantyDuration: parseItemWarranty(item),
      },
    ])
    setItemSearch("")
    setBuilderMessage("")
  }

  const handleProductSearchSubmit = (event) => {
    event.preventDefault()
    const query = itemSearch.trim().toLowerCase()
    if (!query) return

    const exact = itemResults.find((item) => {
      return [item.itemCode, item.barcode]
        .filter(Boolean)
        .some((val) => String(val).trim().toLowerCase() === query)
    })

    if (exact) {
      addProductToCart(exact)
      return
    }

    if (itemResults.length === 1) {
      addProductToCart(itemResults[0])
      return
    }

    setItemMessage("Select an item from the list below.")
  }

  const updateCartLine = (localId, patch) => {
    setCart((current) =>
      current.map((line) => {
        if (line.localId !== localId) return line
        const updated = { ...line, ...patch }
        if (updated.type === "SERVICE" && (Object.hasOwn(patch, "baseUnitPrice") || Object.hasOwn(patch, "markupPercent"))) {
          updated.unitPrice = String(getServiceMarkupAdjustedPrice(updated.baseUnitPrice, updated.markupPercent))
        }
        return updated
      })
    )
    setBuilderMessage("")
  }

  const removeCartLine = (localId) => {
    setCart((current) => current.filter((line) => line.localId !== localId))
  }

  const addServiceLine = (event) => {
    event.preventDefault()
    const desc = serviceDescription.trim()
    const qty = Number(serviceQuantity || 0)
    const basePrice = Number(serviceUnitPrice || 0)
    const markup = serviceMarkup === "" ? 0 : Number(serviceMarkup)
    const unitPrice = getServiceMarkupAdjustedPrice(basePrice, markup)
    const discount = Number(serviceDiscount || 0)
    const gross = qty * unitPrice

    if (!desc) {
      setBuilderMessage("Enter service or labor description.")
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setBuilderMessage("Service quantity must be greater than zero.")
      return
    }
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      setBuilderMessage("Service base price cannot be negative.")
      return
    }
    if (!Number.isFinite(markup) || markup < 0 || markup >= 100) {
      setBuilderMessage("Service markup percentage must be from 0 up to less than 100.")
      return
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > gross) {
      setBuilderMessage("Discount cannot exceed service line total.")
      return
    }

    const assignedStaff = serviceStaffList.find((s) => s.id === selectedServiceStaffId)

    setCart((current) => [
      ...current,
      {
        localId: `service-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "SERVICE",
        description: desc,
        quantity: String(qty),
        baseUnitPrice: String(basePrice),
        markupPercent: serviceMarkup,
        unitPrice: String(unitPrice),
        discountAmount: String(discount),
        serviceStaffId: assignedStaff?.id || null,
        serviceStaffName: assignedStaff?.fullName || null,
        serviceStaffRole: assignedStaff?.role ? getRoleLabel(assignedStaff.role) : null,
      },
    ])

    setServiceDescription("")
    setServiceQuantity("1")
    setServiceUnitPrice("")
    setServiceMarkup("")
    setServiceDiscount("0")
    setShowServiceForm(false)
    setBuilderMessage("")
  }

  const handleOpenView = async (quotation) => {
    setIsLoadingDetails(true)
    try {
      const response = await getQuotationById(quotation.id)
      const detailed = response?.data || quotation
      setSelectedQuotation(detailed)
      setIsPrintPreviewOpen(true)
    } catch {
      setSelectedQuotation(quotation)
      setIsPrintPreviewOpen(true)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleDeleteQuotation = async (quotation) => {
    if (!quotation?.id) return
    const ok = window.confirm(
      `Are you sure you want to delete / cancel Quotation ${quotation.quotationCode || ""}? This action cannot be undone.`
    )
    if (!ok) return

    try {
      await updateQuotationStatus(quotation.id, {
        status: "CANCELLED",
        remarks: "Cancelled/Deleted from quotation records archive",
      })
      await loadQuotations()
    } catch (err) {
      alert(err?.response?.data?.message || err?.response?.data?.error?.message || "Failed to delete quotation.")
    }
  }

  // Submit / Preview Quotation Builder
  const handlePreviewQuotation = () => {
    if (cart.length === 0) {
      setBuilderMessage("Quotation cart is empty. Please add items or service lines first.")
      return
    }
    if (!selectedCustomerId && !customerSearch.trim()) {
      setBuilderMessage("Customer name is required before generating quotation.")
      customerInputRef.current?.focus()
      return
    }

    const activeCustomer = customers.find((c) => c.id === selectedCustomerId)

    const previewDoc = {
      quotationCode: "PREVIEW",
      createdAt: new Date().toISOString(),
      branch: selectedBranch || user?.branch || { name: branchName },
      customer: activeCustomer || {
        fullName: customerSearch.trim(),
        mobileNumber: customerPhone.trim() || undefined,
        address: customerAddress.trim() || undefined,
        email: customerEmail.trim() || undefined,
      },
      customerName: customerSearch.trim() || activeCustomer?.fullName || "Walk-in Customer",
      preparedBy: user || { fullName: "Staff" },
      grandTotal: totals.grandTotal,
      subtotalAmount: totals.productGross + totals.serviceGross,
      totalDiscountAmount: totals.totalDiscount,
      notes: remarks.trim() || undefined,
      isPcBuild,
      items: cart.map((line, index) => {
        const unitPrice = getLineUnitPrice(line)
        const gross = getLineGross(line)
        const lineTotal = getLineTotal(line)

        return {
          id: `preview-${index}`,
          description: line.item?.itemName || line.description,
          itemCode: line.item?.itemCode,
          quantity: Number(line.quantity),
          unitPrice,
          lineTotal,
          warrantyDuration: line.warrantyDuration,
          serviceStaffName: line.serviceStaffName,
        }
      }),
    }

    setActiveQuotationDoc(previewDoc)
    setIsQuotationPreviewMode(true)
    setIsQuotationDocOpen(true)
  }

  const handleSaveQuotation = async () => {
    if (cart.length === 0) {
      setBuilderMessage("Quotation cart is empty.")
      return
    }
    if (!selectedCustomerId && !customerSearch.trim()) {
      setBuilderMessage("Customer name is required.")
      customerInputRef.current?.focus()
      return
    }

    setIsCreatingQuotation(true)
    setBuilderMessage("")

    try {
      let effectiveCustomerId = selectedCustomerId || undefined

      // Auto create customer record if walk-in typed with phone/address
      if (!effectiveCustomerId && customerSearch.trim()) {
        try {
          const custRes = await createCustomer({
            branchId,
            fullName: customerSearch.trim(),
            mobileNumber: customerPhone.trim() || undefined,
            address: customerAddress.trim() || undefined,
            email: customerEmail.trim() || undefined,
            priceTier: selectedPriceTier || 1,
          })
          if (custRes?.data?.id) {
            effectiveCustomerId = custRes.data.id
            loadCustomers()
          }
        } catch {
          // ignore
        }
      }

      const serviceLineWithDoneBy = cart.find((l) => l.type === "SERVICE" && l.serviceStaffId)
      const serviceDoneById = serviceLineWithDoneBy?.serviceStaffId || undefined

      const formattedRemarks = isPcBuild
        ? (remarks.trim() ? `[PC BUILD] ${remarks.trim()}` : "[PC BUILD]")
        : remarks.trim() || undefined

      const quotationPayload = {
        branchId,
        customerId: effectiveCustomerId,
        serviceDoneById,
        title: isPcBuild ? "PC Build Quotation" : (formattedRemarks || undefined),
        notes: serializeQuotationNotes(remarks.trim(), {
          installmentCalculation: showFinancingCalc ? installmentCalculation : undefined,
        }),
        isPcBuild,
        items: cart.map((line) => {
          if (line.type === "SERVICE") {
            const rawDesc = line.description.trim()
            const finalDesc = line.serviceStaffName
              ? `${rawDesc} [Done by: ${line.serviceStaffName}]`
              : rawDesc

            return {
              description: finalDesc,
              priceTier: 1,
              quantity: Number(line.quantity),
              unitPrice: Number(line.baseUnitPrice ?? line.unitPrice),
              markupPercent: line.markupPercent === "" ? 0 : Number(line.markupPercent),
              discountAmount: Number(line.discountAmount || 0),
              isPcBuildPart: isPcBuild,
            }
          }

          return {
            itemId: line.itemId,
            priceTier: Number(line.priceTier),
            markupPercent: line.markupPercent === "" ? 0 : Number(line.markupPercent),
            quantity: Number(line.quantity),
            discountAmount: Number(line.discountAmount || 0),
            isPcBuildPart: isPcBuild,
            warrantyDuration: line.warrantyDuration || undefined,
          }
        }),
      }

      const response = await createQuotation(quotationPayload)
      const createdQuote = response?.data || response

      if (!createdQuote?.id) {
        throw new Error("Invalid quotation response")
      }

      setNoticeMessage(`Quotation ${createdQuote.quotationCode || ""} created successfully!`)
      setActiveQuotationDoc(createdQuote)
      setIsQuotationPreviewMode(false)
      setIsQuotationDocOpen(true)

      // Reset builder cart
      setCart([])
      setRemarks("")
      loadQuotations()
    } catch (err) {
      setBuilderMessage(err?.response?.data?.message || err?.message || "Failed to create quotation.")
    } finally {
      setIsCreatingQuotation(false)
    }
  }

  return (
    <section className="space-y-6">
      {/* Header Banner & Mode Switcher */}
      <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-soft)]/40 to-[var(--color-card)] p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-[var(--color-maroon)]/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">
                Quotations Module
              </span>
              <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-[var(--color-text-strong)]">
                {branchName}
              </span>
            </div>
            <h1 className="mt-2.5 text-3xl font-black tracking-tight text-[var(--color-text-strong)]">
              {viewMode === "BUILDER" ? "Quotation Builder (POS Mode)" : "Quotation History & Archive"}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {viewMode === "BUILDER"
                ? "Build and itemize customer quotations with live product search, price tiers, and service labor."
                : "Historical archive of official customer quotations. View itemized lines, print official copies, or delete records."}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {viewMode === "HISTORY" ? (
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)]"
                onClick={() => setViewMode("BUILDER")}
                type="button"
              >
                <Plus size={16} />
                + Create New Quotation
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-3 text-sm font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)]"
                onClick={() => setViewMode("HISTORY")}
                type="button"
              >
                <FileSpreadsheet size={16} />
                View Quotation Records
              </button>
            )}

            <button
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-3 text-sm font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)]"
              disabled={isLoading}
              onClick={loadQuotations}
              type="button"
            >
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={16} />
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Global Notice Alert */}
        {noticeMessage ? (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <span>{noticeMessage}</span>
            <button
              className="text-emerald-700 hover:text-emerald-900"
              onClick={() => setNoticeMessage("")}
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}
      </div>

      {/* VIEW MODE: BUILDER (POS CASHIERING STYLE) */}
      {viewMode === "BUILDER" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
          {/* Left Column: Customer, Products Search, and Service Lines */}
          <div className="space-y-4">
            {/* 1. Customer Selection Card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-blue-50 text-blue-700">
                    <User size={15} />
                  </span>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Customer Information
                    </h2>
                  </div>
                </div>
                {selectedCustomerId || customerSearch ? (
                  <button
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:underline"
                    onClick={() => {
                      setSelectedCustomerId("")
                      setCustomerSearch("")
                      setCustomerPhone("")
                      setCustomerAddress("")
                      setCustomerEmail("")
                    }}
                    type="button"
                  >
                    <X size={11} /> Clear
                  </button>
                ) : null}
              </div>

              {/* Customer Search Autocomplete */}
              <div className="relative" ref={customerDropdownRef}>
                <input
                  ref={customerInputRef}
                  aria-label="Customer Name"
                  className={`w-full rounded-xl border bg-slate-50/50 py-2 pl-3 pr-8 text-xs font-medium outline-none transition focus:bg-white ${
                    !selectedCustomerId && !customerSearch.trim() && builderMessage?.includes("Customer")
                      ? "border-red-400 focus:border-red-500"
                      : "border-slate-200 focus:border-[var(--color-maroon)]"
                  }`}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value)
                    setIsCustomerDropdownOpen(true)
                    if (!e.target.value.trim()) setSelectedCustomerId("")
                  }}
                  onFocus={() => setIsCustomerDropdownOpen(true)}
                  placeholder="Type customer name (e.g. Juan Dela Cruz) *required…"
                  value={customerSearch}
                />

                {isCustomerDropdownOpen && customerSearch.trim() && customers.length > 0 ? (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl text-xs">
                    <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Existing Customers
                    </div>
                    {customers.slice(0, 8).map((c) => (
                      <button
                        className="block w-full border-b border-slate-100 px-3 py-2 text-left transition last:border-b-0 hover:bg-blue-50/60"
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomerId(c.id)
                          setCustomerSearch(c.fullName)
                          setCustomerPhone(c.mobileNumber || "")
                          setCustomerAddress(c.address || "")
                          setCustomerEmail(c.email || "")
                          setIsCustomerDropdownOpen(false)
                          if (c.priceTier) setSelectedPriceTier(Number(c.priceTier))
                        }}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">{c.fullName}</span>
                          {c.priceTier ? (
                            <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.2 text-[10px] font-bold text-blue-800">
                              Tier {c.priceTier}
                            </span>
                          ) : null}
                        </div>
                        {c.mobileNumber || c.address ? (
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {[c.mobileNumber, c.address].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Contact & Address Fields */}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Contact No.</span>
                  <input
                    className="mt-0.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs outline-none transition focus:bg-white focus:border-[var(--color-maroon)]"
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0917xxxxxxx"
                    value={customerPhone}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Address</span>
                  <input
                    className="mt-0.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs outline-none transition focus:bg-white focus:border-[var(--color-maroon)]"
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="City / Municipality"
                    value={customerAddress}
                  />
                </label>
              </div>

              {/* Price Tier Selection */}
              <div className="space-y-1 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Default Quotation Price Tier
                  </span>
                  <span className="text-[10px] text-slate-400">Pricing applies to products</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => {
                        setSelectedPriceTier(tier)
                        setCart((curr) =>
                          curr.map((l) => {
                            if (l.type !== "PRODUCT" || !l.item) return l
                            const av = availablePriceTiers(l.item)
                            return av.includes(tier) ? { ...l, priceTier: tier } : l
                          })
                        )
                      }}
                      className={`rounded-lg py-1 text-center text-xs font-bold transition ${
                        selectedPriceTier === tier
                          ? "bg-[var(--color-maroon)] text-white shadow-2xs"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Tier {tier}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* 2. Product Search Card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-rose-50 text-[var(--color-maroon)]">
                    <PackageSearch size={15} />
                  </span>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Find Products & Parts
                    </h2>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400">Scan barcode or type name</span>
              </div>

              <form className="relative" onSubmit={handleProductSearchSubmit}>
                <Barcode className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  aria-label="Search products"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-9 pr-9 text-xs font-medium text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:bg-white"
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Scan barcode or search product name, brand, code…"
                  value={itemSearch}
                />
                {isLoadingItems ? <LoaderCircle className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-maroon)]" size={15} /> : null}
              </form>

              {itemMessage ? <p className="text-xs font-semibold text-amber-700">{itemMessage}</p> : null}

              <div className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
                {itemResults.map((item) => (
                  <button
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2 text-left transition hover:border-[var(--color-maroon)] hover:bg-rose-50/20 shadow-2xs"
                    key={item.id}
                    onClick={() => addProductToCart(item)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-slate-900">{item.itemName}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <span>{item.itemCode}</span>
                        {item.barcode ? <span>· {item.barcode}</span> : null}
                      </span>
                      <span className="mt-0.5 block text-xs font-mono font-bold text-[var(--color-maroon)]">
                        ₱{money(item[`price${defaultPriceTier(item)}`])}
                      </span>
                    </span>
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700 hover:bg-[var(--color-maroon)] hover:text-white transition">
                      <Plus size={14} />
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* 3. Service & Labor Line Card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-violet-50 text-violet-700">
                    <Wrench size={15} />
                  </span>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Service / Labor Line
                    </h2>
                  </div>
                </div>
                <button
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                  onClick={() => setShowServiceForm((curr) => !curr)}
                  type="button"
                >
                  {showServiceForm ? "Close" : "+ Add Service"}
                </button>
              </div>

              {showServiceForm ? (
                <form className="grid gap-2.5 sm:grid-cols-2 pt-2 border-t border-slate-100 text-xs" onSubmit={addServiceLine}>
                  {/* Service Performer */}
                  <div className="sm:col-span-2 space-y-1 rounded-xl border border-violet-100 bg-violet-50/40 p-2.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-violet-900 flex items-center gap-1">
                      <UserRound size={12} /> Service Performer (Optional)
                    </span>
                    <select
                      className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none"
                      onChange={(e) => setSelectedServiceStaffId(e.target.value)}
                      value={selectedServiceStaffId}
                    >
                      <option value="">No specific staff assigned</option>
                      {serviceStaffList.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.fullName} ({getRoleLabel(st.role)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="sm:col-span-2 block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Service Scope / Description *</span>
                    <input
                      className="mt-0.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs outline-none focus:bg-white focus:border-[var(--color-maroon)]"
                      onChange={(e) => setServiceDescription(e.target.value)}
                      placeholder="e.g. Deep Cleaning & Repasting / Board Repair"
                      value={serviceDescription}
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Base Price (₱) *</span>
                    <input
                      className="mt-0.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-mono font-bold outline-none focus:bg-white focus:border-[var(--color-maroon)]"
                      min="0"
                      onChange={(e) => setServiceUnitPrice(e.target.value)}
                      placeholder="500.00"
                      step="0.01"
                      type="number"
                      value={serviceUnitPrice}
                    />
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Markup % (Optional)</span>
                    <input
                      className="mt-0.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs outline-none focus:bg-white focus:border-[var(--color-maroon)]"
                      max="99.99"
                      min="0"
                      onChange={(e) => setServiceMarkup(e.target.value)}
                      placeholder="0"
                      step="0.01"
                      type="number"
                      value={serviceMarkup}
                    />
                  </label>

                  <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                    <button
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      onClick={() => setShowServiceForm(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="rounded-xl bg-violet-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-violet-800 transition"
                      type="submit"
                    >
                      Add Service Line
                    </button>
                  </div>
                </form>
              ) : null}
            </section>
          </div>

          {/* Right Column: Quotation Cart & Settlement Actions */}
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-rose-50 text-[var(--color-maroon)]">
                    <FileText size={15} />
                  </span>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Quotation Cart ({cart.length})
                    </h2>
                  </div>
                </div>

                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPcBuild}
                    onChange={(e) => setIsPcBuild(e.target.checked)}
                    className="size-3.5 rounded text-[var(--color-maroon)] focus:ring-0"
                  />
                  <span className="text-[11px] font-bold text-slate-700">PC Build</span>
                </label>
              </div>

              {/* Cart Line Items */}
              {cart.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <p className="font-bold text-slate-600">Quotation cart is empty</p>
                  <p className="mt-0.5 text-[11px]">Search products or add service line on the left.</p>
                </div>
              ) : (
                <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1 text-xs">
                  {cart.map((line, index) => (
                    <article
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 space-y-2 shadow-2xs"
                      key={line.localId}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              #{index + 1} · {line.type === "SERVICE" ? "Service" : "Product"}
                            </span>
                            {isPcBuild && line.type === "PRODUCT" ? (
                              <span className="rounded bg-rose-50 border border-rose-200 px-1.5 py-0.2 text-[9px] font-black text-[var(--color-maroon)]">
                                PC Part
                              </span>
                            ) : null}
                          </div>
                          <h3 className="truncate font-bold text-slate-900">{line.item?.itemName || line.description}</h3>
                          {line.item ? <p className="text-[10px] font-mono text-slate-400">{line.item.itemCode}</p> : null}
                          {line.serviceStaffName ? (
                            <p className="text-[10px] font-semibold text-rose-800">👤 {line.serviceStaffName}</p>
                          ) : null}
                        </div>
                        <button
                          className="rounded-lg p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition shrink-0"
                          onClick={() => removeCartLine(line.localId)}
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Product Line Controls */}
                      {line.type === "PRODUCT" ? (
                        <div className="grid gap-1.5 grid-cols-4 pt-1 border-t border-slate-200/60">
                          <label className="block">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">Tier</span>
                            <select
                              className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-semibold outline-none"
                              onChange={(e) => updateCartLine(line.localId, { priceTier: Number(e.target.value) })}
                              value={line.priceTier}
                            >
                              {availablePriceTiers(line.item).map((t) => (
                                <option key={t} value={t}>
                                  T{t} (₱{money(line.item[`price${t}`])})
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">Qty</span>
                            <input
                              className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-bold outline-none"
                              min="1"
                              onChange={(e) => updateCartLine(line.localId, { quantity: e.target.value })}
                              type="number"
                              value={line.quantity}
                            />
                          </label>

                          <label className="block">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">Markup %</span>
                            <input
                              className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs outline-none"
                              max="99.99"
                              min="0"
                              onChange={(e) => updateCartLine(line.localId, { markupPercent: e.target.value })}
                              placeholder="0"
                              step="0.01"
                              type="number"
                              value={line.markupPercent ?? ""}
                            />
                          </label>

                          <label className="block">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">Discount</span>
                            <input
                              className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-mono outline-none"
                              min="0"
                              onChange={(e) => updateCartLine(line.localId, { discountAmount: e.target.value })}
                              step="0.01"
                              type="number"
                              value={line.discountAmount}
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="grid gap-1.5 grid-cols-4 pt-1 border-t border-slate-200/60">
                          <label className="block">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">Qty</span>
                            <input
                              className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs"
                              min="1"
                              onChange={(e) => updateCartLine(line.localId, { quantity: e.target.value })}
                              type="number"
                              value={line.quantity}
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">Base (₱)</span>
                            <input
                              className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-mono"
                              min="0"
                              onChange={(e) => updateCartLine(line.localId, { baseUnitPrice: e.target.value })}
                              step="0.01"
                              type="number"
                              value={line.baseUnitPrice ?? line.unitPrice}
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">Markup %</span>
                            <input
                              className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs"
                              max="99.99"
                              min="0"
                              onChange={(e) => updateCartLine(line.localId, { markupPercent: e.target.value })}
                              placeholder="0"
                              step="0.01"
                              type="number"
                              value={line.markupPercent ?? ""}
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">Discount</span>
                            <input
                              className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-mono"
                              min="0"
                              onChange={(e) => updateCartLine(line.localId, { discountAmount: e.target.value })}
                              step="0.01"
                              type="number"
                              value={line.discountAmount}
                            />
                          </label>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                          <ShieldCheck size={12} /> {line.warrantyDuration || "1 YEAR WARRANTY"}
                        </span>
                        <span className="font-mono font-black text-slate-900">
                          ₱{money(getLineTotal(line))}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {/* Quotation Remarks */}
              <label className="block pt-1 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Quotation Remarks / Notes</span>
                <input
                  className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-maroon)]"
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Special pricing terms or package notes..."
                  value={remarks}
                />
              </label>

              {/* Financing Calculation Option */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 text-xs">Financing / Installment Inquiries</span>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showFinancingCalc}
                      onChange={(e) => setShowFinancingCalc(e.target.checked)}
                      className="size-3.5 rounded text-blue-700"
                    />
                    <span className="text-[10px] font-bold text-blue-800">Include Terms</span>
                  </label>
                </div>

                {showFinancingCalc ? (
                  <div className="space-y-1.5 pt-1 border-t border-blue-200/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-blue-900">Select Term:</span>
                      <select
                        className="rounded-lg border border-blue-200 bg-white px-2 py-0.5 text-xs font-bold text-blue-950 outline-none"
                        onChange={(e) => setSelectedTerm(e.target.value)}
                        value={selectedTerm}
                      >
                        {INSTALLMENT_TERMS.map(([val, lbl]) => (
                          <option key={val} value={val}>
                            {lbl} (Rate: {installmentRates?.[val] ?? DEFAULT_INSTALLMENT_BASIS[val]})
                          </option>
                        ))}
                      </select>
                    </div>

                    {installmentCalculation ? (
                      <div className="grid grid-cols-2 gap-1.5 text-center">
                        <div className="rounded-lg bg-white p-1.5 border border-blue-100">
                          <span className="text-[10px] text-slate-400 block">Financed Total</span>
                          <span className="font-mono font-bold text-[var(--color-maroon)]">
                            ₱{money(installmentCalculation.regularPriceTotalAmount)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-emerald-50 p-1.5 border border-emerald-200">
                          <span className="text-[10px] text-emerald-800 block">Monthly ({installmentCalculation.months} mos)</span>
                          <span className="font-mono font-bold text-emerald-950">
                            ₱{money(installmentCalculation.monthlyDueAmount)}/mo
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Totals Summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Products Gross</span>
                  <span className="font-mono">₱{money(totals.productGross)}</span>
                </div>
                {totals.serviceGross > 0 ? (
                  <div className="flex justify-between text-slate-600">
                    <span>Service Labor</span>
                    <span className="font-mono">₱{money(totals.serviceGross)}</span>
                  </div>
                ) : null}
                {totals.totalDiscount > 0 ? (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discounts</span>
                    <span className="font-mono">-₱{money(totals.totalDiscount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between items-center border-t border-slate-200 pt-1.5 text-slate-900 font-bold">
                  <span className="text-xs uppercase tracking-wider">Quotation Total</span>
                  <span className="font-mono text-base font-black text-slate-900">₱{money(totals.grandTotal)}</span>
                </div>
              </div>

              {builderMessage ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs font-bold text-rose-800 flex items-center gap-1.5">
                  <CircleAlert size={14} className="shrink-0" />
                  <span>{builderMessage}</span>
                </div>
              ) : null}

              {/* Builder Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
                  disabled={cart.length === 0}
                  onClick={handlePreviewQuotation}
                  type="button"
                >
                  <Eye size={15} />
                  Preview
                </button>

                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-3 py-2.5 text-xs font-black text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:opacity-50"
                  disabled={cart.length === 0 || isCreatingQuotation}
                  onClick={handleSaveQuotation}
                  type="button"
                >
                  {isCreatingQuotation ? (
                    <>
                      <LoaderCircle className="animate-spin" size={15} />
                      Saving…
                    </>
                  ) : (
                    <>
                      <FileText size={15} />
                      Save & Print Quote
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {/* VIEW MODE: HISTORY TABLE */}
      {viewMode === "HISTORY" ? (
        <>
          {/* 3 Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <FileSpreadsheet size={20} />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-[var(--color-muted)]">
                    Total Quotations
                  </p>
                  <p className="mt-1 font-mono text-2xl font-black text-[var(--color-text-strong)]">
                    {metrics.totalCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-amber-600 text-white">
                  <FileText size={20} />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Active Quoted Total
                  </p>
                  <p className="mt-1 font-mono text-2xl font-black text-[var(--color-text-strong)]">
                    ₱{money(metrics.totalQuotedAmount)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-[var(--color-card)] to-[var(--color-card)] p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-emerald-600 text-white">
                  <FileCheck2 size={20} />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Converted to Sales
                  </p>
                  <p className="mt-1 font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
                    {metrics.convertedCount} Quotation{metrics.convertedCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Records Table Container */}
          <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
            {/* Filters Header */}
            <div className="grid gap-3 border-b border-[var(--color-border)] p-4 md:grid-cols-[1fr_auto]">
              <label className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={16} />
                <input
                  className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-3 pl-10 pr-4 text-sm text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search quotation number, customer name, encoder..."
                  value={searchQuery}
                />
              </label>

              <select
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
                onChange={(e) => setStatusFilter(e.target.value)}
                value={statusFilter}
              >
                <option value="ALL">All Statuses</option>
                <option value="QUOTED">Quoted</option>
                <option value="CONVERTED">Converted to Sale</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {message && quotations.length === 0 ? (
              <div className="p-8 text-center text-sm font-semibold text-[var(--color-muted)]">
                {message}
              </div>
            ) : null}

            {isLoading ? (
              <div className="p-8 text-center text-sm font-semibold text-[var(--color-muted)]">
                Loading quotation records...
              </div>
            ) : null}

            {!isLoading && filteredQuotations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-[var(--color-soft)] text-xs font-black uppercase tracking-wider text-[var(--color-muted)]">
                    <tr>
                      <th className="px-5 py-4">Quotation No.</th>
                      <th className="px-5 py-4">Customer</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4 text-center">Items</th>
                      <th className="px-5 py-4">Prepared By</th>
                      <th className="px-5 py-4 text-right">Grand Total</th>
                      <th className="px-5 py-4">Date Quoted</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {filteredQuotations.map((quotation) => {
                      const badge = formatStatusBadge(quotation.status)
                      return (
                        <tr
                          className="transition hover:bg-[var(--color-soft)]/50"
                          key={quotation.id}
                        >
                          <td className="px-5 py-4 font-mono font-bold text-sm text-[var(--color-text-strong)]">
                            {quotation.quotationCode || "—"}
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-bold text-sm text-[var(--color-text-strong)]">
                              {quotation.customer?.fullName || quotation.customerName || "Walk-in Customer"}
                            </p>
                            {quotation.customer?.mobileNo ? (
                              <p className="text-xs text-[var(--color-muted)]">{quotation.customer.mobileNo}</p>
                            ) : null}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${badge.className}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center font-mono font-bold text-xs text-[var(--color-text-strong)]">
                            {getItemCount(quotation)}
                          </td>
                          <td className="px-5 py-4 text-xs font-medium text-[var(--color-muted)]">
                            <div className="flex items-center gap-1.5">
                              <User size={13} />
                              <span>{quotation.preparedBy?.fullName || quotation.preparedByName || "—"}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right font-mono font-black text-sm text-[var(--color-text-strong)]">
                            ₱{money(quotation.grandTotal || quotation.totalAmount)}
                          </td>
                          <td className="px-5 py-4 text-xs text-[var(--color-muted)]">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={13} />
                              <span>{formatDate(quotation.createdAt)}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)]"
                                disabled={isLoadingDetails}
                                onClick={() => handleOpenView(quotation)}
                                title="View quotation details"
                                type="button"
                              >
                                <Eye size={13} />
                                <span>View</span>
                              </button>

                              <button
                                className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)]"
                                disabled={isLoadingDetails}
                                onClick={() => handleOpenView(quotation)}
                                title="Print quotation copy"
                                type="button"
                              >
                                <Printer size={13} />
                                <span>Print</span>
                              </button>

                              {quotation.status !== "CANCELLED" && quotation.status !== "CONVERTED" ? (
                                <button
                                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                                  onClick={() => handleDeleteQuotation(quotation)}
                                  title="Delete / Cancel quotation"
                                  type="button"
                                >
                                  <Trash2 size={13} />
                                  <span>Delete</span>
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {!isLoading && quotations.length > 0 && filteredQuotations.length === 0 ? (
              <div className="p-8 text-center text-sm font-semibold text-[var(--color-muted)]">
                No quotations match the selected status or search filter.
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {/* VIEW & PRINT MODAL FOR HISTORY RECORD */}
      {isPrintPreviewOpen && selectedQuotation ? (
        <QuotationDetailDialog
          onClose={() => setIsPrintPreviewOpen(false)}
          quotation={selectedQuotation}
        />
      ) : null}

      {/* BUILDER PREVIEW / SAVE PRINT DIALOG */}
      {isQuotationDocOpen && activeQuotationDoc ? (
        <QuotationDetailDialog
          installmentCalculation={showFinancingCalc ? installmentCalculation : null}
          isPreview={isQuotationPreviewMode}
          isSavingQuotation={isCreatingQuotation}
          onClose={() => {
            setIsQuotationDocOpen(false)
            setActiveQuotationDoc(null)
          }}
          onSaveQuotation={isQuotationPreviewMode ? handleSaveQuotation : null}
          quotation={activeQuotationDoc}
        />
      ) : null}
    </section>
  )
}
