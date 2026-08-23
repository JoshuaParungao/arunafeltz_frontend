import { useEffect, useMemo, useRef, useState } from "react"

import { createPortal } from "react-dom"

import {
  createQuotation,
  getQuotationById,
  getQuotationServiceStaff,
  getQuotations,
  updateQuotation,
  updateQuotationStatus,
} from "../../features/quotations/quotations.api"
import { getItems } from "../../features/items/items.api"
import { getCustomers } from "../../features/customers/customers.api"
import {
  getInventoryBatches,
  getInventorySerials,
} from "../../features/inventory/inventory.api"
import { createSale } from "../../features/sales/sales.api"
import { generateUUID } from "../../utils/uuid"

const IMMEDIATE_PAYMENT_METHODS = [
  ["CASH", "Cash"],
  ["GCASH", "GCash"],
  ["BANK_TRANSFER", "Bank transfer"],
  ["OTHER", "Other"],
]

const RECEIVABLE_PROVIDERS = [
  ["CREDIT_CARD", "Credit card receivable"],
  ["DEBIT_CARD", "Debit card receivable"],
  ["HOMECREDIT", "Home Credit"],
  ["SALMON", "Salmon"],
  ["KYRO", "Kyro"],
  ["OTHER_FINANCING", "Other financing"],
  ["IN_HOUSE_INSTALLMENT", "In-house installment"],
]

const RECEIVABLE_PROVIDER_VALUES = new Set(
  RECEIVABLE_PROVIDERS.map(([value]) => value),
)

const INSTALLMENT_TERMS = [
  ["STRAIGHT", "Straight / 1 month"],
  ["MONTH_3", "3 months"],
  ["MONTH_6", "6 months"],
  ["MONTH_9", "9 months"],
  ["MONTH_12", "12 months"],
  ["MONTH_18", "18 months"],
  ["MONTH_24", "24 months"],
]

function createRequestKey() {
  return generateUUID()
}

function money(value) {
  const amount = Number(value || 0)

  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function getMarkupAdjustedPrice(basePrice, markupPercent) {
  const base = Number(basePrice || 0)
  const markup =
    markupPercent === "" || markupPercent === undefined || markupPercent === null
      ? 0
      : Number(markupPercent)

  if (!Number.isFinite(base)) return 0
  if (!Number.isFinite(markup) || markup < 0 || markup >= 100) return base

  return Math.round((base / (1 - markup / 100) + Number.EPSILON) * 100) / 100
}

function getServiceMarkupAdjustedPrice(basePrice, markupPercent) {
  const base = Number(basePrice || 0)
  const markup =
    markupPercent === "" || markupPercent === undefined || markupPercent === null
      ? 0
      : Number(markupPercent)

  if (!Number.isFinite(base)) return 0
  if (!Number.isFinite(markup) || markup < 0 || markup >= 100) return base

  return Math.round((base / (1 - markup / 100)) * 100) / 100
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

function QuotationPrintPreview({ quotation, onClose }) {
  const items = quotation.items || []
  const hasCustomServiceLines = items.some((item) => !item.itemId)
  const customer = quotation.customer
  const branch = quotation.branch

  return createPortal(
    <div
      aria-labelledby="quotation-print-title"
      aria-modal="true"
      className="quotation-print-overlay"
      role="dialog"
    >
      <div className="quotation-print-shell">
        <div className="quotation-print-actions">
          <div>
            <p className="text-sm font-bold text-white">Customer quotation preview</p>
            <p className="text-xs text-white/70">Only customer-facing information will print.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20"
              onClick={onClose}
              type="button"
            >
              Close preview
            </button>
            <button
              className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[var(--color-maroon)] transition hover:bg-[var(--color-soft)]"
              onClick={() => window.print()}
              type="button"
            >
              Print
            </button>
          </div>
        </div>

        <article className="quotation-print-document">
          <header className="border-b-2 border-[var(--color-maroon)] pb-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-[var(--color-maroon)]">
                  Arunafeltz Computer
                </p>
                <h1
                  className="mt-2 text-3xl font-black tracking-tight text-[var(--color-text-strong)]"
                  id="quotation-print-title"
                >
                  Customer Quotation
                </h1>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  {branch?.name || "Arunafeltz Computer branch"}
                  {branch?.code ? ` • ${branch.code}` : ""}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Quotation number
                </p>
                <p className="mt-1 text-lg font-black text-[var(--color-text-strong)]">
                  {quotation.quotationCode || "—"}
                </p>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  Date: {formatDate(quotation.createdAt)}
                </p>
                <p className="text-sm text-[var(--color-muted)]">
                  Valid until: {formatDate(quotation.validUntil)}
                </p>
              </div>
            </div>
          </header>

          <section className="grid gap-5 border-b border-[var(--color-border)] py-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Quotation for
              </p>
              <p className="mt-2 text-lg font-black text-[var(--color-text-strong)]">
                {customer?.fullName || "Walk-in customer"}
              </p>
              {customer?.companyName ? (
                <p className="mt-1 text-sm text-[var(--color-text)]">{customer.companyName}</p>
              ) : null}
              {customer?.address ? (
                <p className="mt-1 text-sm text-[var(--color-text)]">{customer.address}</p>
              ) : null}
              {(customer?.mobileNumber || customer?.email) ? (
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {[customer.mobileNumber, customer.email].filter(Boolean).join(" • ")}
                </p>
              ) : null}
            </div>
            <div className="sm:text-right">
              {quotation.title ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Subject
                  </p>
                  <p className="mt-2 font-bold text-[var(--color-text-strong)]">
                    {quotation.title}
                  </p>
                </>
              ) : null}
            </div>
          </section>

          <div className="overflow-x-auto py-5">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-[var(--color-border)] bg-[var(--color-soft)] text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">
                  <th className="px-3 py-3">Item / service</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3 text-right">Unit price</th>
                  <th className="px-3 py-3 text-right">Discount</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    className="quotation-print-row border-b border-[var(--color-border)]"
                    key={item.id || item.lineNo}
                  >
                    <td className="px-3 py-4">
                      <p className="font-bold text-[var(--color-text-strong)]">{item.description}</p>
                      {item.remarks ? (
                        <p className="mt-1 text-xs text-[var(--color-muted)]">{item.remarks}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 text-right">{Number(item.quantity || 0)}</td>
                    <td className="px-3 py-4 text-right">₱{money(item.unitPrice)}</td>
                    <td className="px-3 py-4 text-right">₱{money(item.discountAmount)}</td>
                    <td className="px-3 py-4 text-right font-bold text-[var(--color-text-strong)]">
                      ₱{money(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="ml-auto w-full max-w-sm border-t-2 border-[var(--color-text-strong)] pt-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span>Subtotal</span>
              <span className="font-bold">₱{money(quotation.subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4 text-sm">
              <span>Total discount</span>
              <span className="font-bold">₱{money(quotation.totalDiscount)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 border-t border-[var(--color-border)] pt-3 text-lg font-black text-[var(--color-text-strong)]">
              <span>Grand total</span>
              <span>₱{money(quotation.grandTotal)}</span>
            </div>
          </section>

          <section className="mt-8 grid gap-5 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Prepared by
              </p>
              <p className="mt-2 font-bold text-[var(--color-text-strong)]">
                {quotation.preparedBy?.fullName || "—"}
              </p>
            </div>
            {hasCustomServiceLines ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Service done by
                </p>
                <p className="mt-2 font-bold text-[var(--color-text-strong)]">
                  {quotation.serviceDoneBy?.fullName || "—"}
                </p>
              </div>
            ) : null}
          </section>

          {quotation.notes ? (
            <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Notes
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-strong)]">
                {quotation.notes}
              </p>
            </section>
          ) : null}

          <footer className="mt-8 border-t border-[var(--color-border)] pt-4 text-center text-xs text-[var(--color-muted)]">
            Thank you for choosing Arunafeltz Computer. This quotation is subject to the stated validity date.
          </footer>
        </article>
      </div>
    </div>,
    document.body,
  )
}

function QuotationsPage({ selectedBranch, user }) {
  const [quotations, setQuotations] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [selectedQuotation, setSelectedQuotation] = useState(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailMessage, setDetailMessage] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingQuotationId, setEditingQuotationId] = useState("")
  const [isSavingQuotation, setIsSavingQuotation] = useState(false)
  const [formMessage, setFormMessage] = useState("")
  const [formTitle, setFormTitle] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [formInternalNotes, setFormInternalNotes] = useState("")
  const [formValidUntil, setFormValidUntil] = useState("")
  const [formIsPcBuild, setFormIsPcBuild] = useState(false)
  const [formQuotationType, setFormQuotationType] = useState("MIXED")
  const [availableCustomers, setAvailableCustomers] = useState([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [customerMessage, setCustomerMessage] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false)
  const [availableServiceStaff, setAvailableServiceStaff] = useState([])
  const [isLoadingServiceStaff, setIsLoadingServiceStaff] = useState(false)
  const [serviceStaffMessage, setServiceStaffMessage] = useState("")
  const [selectedServiceDoneById, setSelectedServiceDoneById] = useState("")
  const [detailServiceDoneById, setDetailServiceDoneById] = useState("")
  const [isSavingServiceDoneBy, setIsSavingServiceDoneBy] = useState(false)
  const [serviceDoneByMessage, setServiceDoneByMessage] = useState("")
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [isConversionOpen, setIsConversionOpen] = useState(false)
  const [conversionLines, setConversionLines] = useState([])
  const [conversionPaymentMethod, setConversionPaymentMethod] = useState("CASH")
  const [conversionSettlementMethod, setConversionSettlementMethod] = useState("CASH")
  const [conversionAmountPaid, setConversionAmountPaid] = useState("")
  const [conversionReferenceNo, setConversionReferenceNo] = useState("")
  const [conversionProviderReferenceNo, setConversionProviderReferenceNo] = useState("")
  const [conversionCreditTerm, setConversionCreditTerm] = useState("MONTH_3")
  const [conversionCreditDueDay, setConversionCreditDueDay] = useState("")
  const [conversionCreditFirstDueDate, setConversionCreditFirstDueDate] = useState("")
  const [conversionRemarks, setConversionRemarks] = useState("")
  const [conversionMessage, setConversionMessage] = useState("")
  const [isLoadingConversionStock, setIsLoadingConversionStock] = useState(false)
  const [isConvertingQuotation, setIsConvertingQuotation] = useState(false)
  const [convertedSale, setConvertedSale] = useState(null)
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false)
  const [lineDescription, setLineDescription] = useState("")
  const [lineQuantity, setLineQuantity] = useState("1")
  const [lineUnitPrice, setLineUnitPrice] = useState("")
  const [lineMarkup, setLineMarkup] = useState("")
  const [lineDiscount, setLineDiscount] = useState("0")
  const [lineRemarks, setLineRemarks] = useState("")
  const [availableItems, setAvailableItems] = useState([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [itemMessage, setItemMessage] = useState("")
  const [selectedItemId, setSelectedItemId] = useState("")
  const [selectedItemPriceTier, setSelectedItemPriceTier] = useState("1")
  const [productSearch, setProductSearch] = useState("")
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false)
  const [productQuantity, setProductQuantity] = useState("1")
  const [productMarkup, setProductMarkup] = useState("")
  const [productDiscount, setProductDiscount] = useState("0")
  const [productRemarks, setProductRemarks] = useState("")
  const [quotationLines, setQuotationLines] = useState([])
  const localLineSequenceRef = useRef(0)
  const conversionRequestRef = useRef({ signature: "", key: "" })
  const detailPanelRef = useRef(null)
  const formPanelRef = useRef(null)

  const nextLocalLineId = (prefix) => {
    localLineSequenceRef.current += 1
    return `${prefix}-${localLineSequenceRef.current}`
  }

  const branchName = selectedBranch?.name || user?.branch?.name || "Selected branch"
  const branchId = selectedBranch?.id || user?.branch?.id || user?.branchId || ""
  const isConversionReceivable = RECEIVABLE_PROVIDER_VALUES.has(
    conversionPaymentMethod,
  )
  const isConversionInHouse =
    conversionPaymentMethod === "IN_HOUSE_INSTALLMENT"

  const filteredQuotations = useMemo(() => {
    if (statusFilter === "ALL") return quotations

    return quotations.filter((quotation) => {
      return String(quotation.status || "DRAFT").toUpperCase() === statusFilter
    })
  }, [quotations, statusFilter])

  const getItemCount = (quotation) => {
    return quotation?._count?.items || quotation?.items?.length || quotation?.itemCount || 0
  }

  const selectedCustomer =
    availableCustomers.find((customer) => customer.id === selectedCustomerId) || null

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.trim().toLowerCase()

    if (!search) return availableCustomers

    return availableCustomers.filter((customer) => {
      const code = String(customer.customerCode || "").toLowerCase()
      const name = String(customer.fullName || "").toLowerCase()
      const mobile = String(customer.mobileNumber || "").toLowerCase()
      const email = String(customer.email || "").toLowerCase()
      const company = String(customer.companyName || "").toLowerCase()

      return (
        code.includes(search) ||
        name.includes(search) ||
        mobile.includes(search) ||
        email.includes(search) ||
        company.includes(search)
      )
    })
  }, [availableCustomers, customerSearch])

  const canShowProductSection = formQuotationType === "PRODUCT" || formQuotationType === "MIXED"
  const canShowCustomSection = formQuotationType === "SERVICE" || formQuotationType === "MIXED"

  const selectedItem = availableItems.find((item) => item.id === selectedItemId) || null
  const selectedItemBasePrice = selectedItem
    ? Number(selectedItem[`price${selectedItemPriceTier}`] || 0)
    : 0
  const selectedItemUnitPrice = getMarkupAdjustedPrice(
    selectedItemBasePrice,
    productMarkup,
  )

  const filteredProductItems = useMemo(() => {
    const search = productSearch.trim().toLowerCase()

    if (!search) return availableItems

    return availableItems.filter((item) => {
      const code = String(item.itemCode || "").toLowerCase()
      const name = String(item.itemName || "").toLowerCase()
      const barcode = String(item.barcode || item.barcodeNo || item.sku || "").toLowerCase()

      return code.includes(search) || name.includes(search) || barcode.includes(search)
    })
  }, [availableItems, productSearch])

  const productGrossTotal = Number(productQuantity || 0) * selectedItemUnitPrice
  const productNetTotal = Math.max(productGrossTotal - Number(productDiscount || 0), 0)

  const lineBaseUnitPrice = Number(lineUnitPrice || 0)
  const lineFinalUnitPrice = getServiceMarkupAdjustedPrice(lineBaseUnitPrice, lineMarkup)
  const lineGrossTotal = Number(lineQuantity || 0) * lineFinalUnitPrice
  const lineNetTotal = Math.max(lineGrossTotal - Number(lineDiscount || 0), 0)

  const quotationLinesTotal = useMemo(() => {
    return quotationLines.reduce((total, line) => total + Number(line.lineTotal || 0), 0)
  }, [quotationLines])

  const hasCustomServiceLines = quotationLines.some((line) => line.type === "CUSTOM")
  const selectedQuotationHasCustomServiceLines = (selectedQuotation?.items || []).some(
    (item) => !item.itemId,
  )

  const totalQuotationAmount = useMemo(() => {
    return filteredQuotations.reduce((total, quotation) => {
      return total + Number(quotation.grandTotal || quotation.totalAmount || 0)
    }, 0)
  }, [filteredQuotations])

  const loadAvailableServiceStaff = async () => {
    if (!branchId) {
      setAvailableServiceStaff([])
      return
    }

    setIsLoadingServiceStaff(true)
    setServiceStaffMessage("")

    try {
      const response = await getQuotationServiceStaff({ branchId })
      const result = response?.data || response || []
      const rows = Array.isArray(result) ? result : []

      setAvailableServiceStaff(rows)

      if (rows.length === 0) {
        setServiceStaffMessage("No eligible active service staff found for this branch.")
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        "Could not load eligible service staff."

      setAvailableServiceStaff([])
      setServiceStaffMessage(errorMessage)
    } finally {
      setIsLoadingServiceStaff(false)
    }
  }

  const loadAvailableCustomers = async () => {
    if (!branchId) {
      setAvailableCustomers([])
      return
    }

    setIsLoadingCustomers(true)
    setCustomerMessage("")

    try {
      const response = await getCustomers({
        branchId,
        status: "ACTIVE",
        limit: 100,
      })

      const result = response?.data ?? response ?? {}
      const rows = Array.isArray(result.customers)
        ? result.customers
        : Array.isArray(result.items)
          ? result.items
          : Array.isArray(result.data)
            ? result.data
            : []

      setAvailableCustomers(rows)

      if (rows.length === 0) {
        setCustomerMessage("No active customers found for this branch. Walk-in is still allowed.")
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        "Could not load customers."

      setAvailableCustomers([])
      setCustomerMessage(errorMessage)
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  const loadAvailableItems = async () => {
    if (!branchId) {
      setAvailableItems([])
      return
    }

    setIsLoadingItems(true)
    setItemMessage("")

    try {
      const response = await getItems({
        branchId,
        status: "ACTIVE",
        limit: 100,
      })

      const result = response?.data ?? response ?? {}
      const rows = Array.isArray(result.items)
        ? result.items
        : Array.isArray(result.data)
          ? result.data
          : Array.isArray(result.records)
            ? result.records
            : []

      setAvailableItems(rows)

      if (rows.length === 0) {
        setItemMessage("No active items found for this branch.")
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        "Could not load product items."

      setAvailableItems([])
      setItemMessage(errorMessage)
    } finally {
      setIsLoadingItems(false)
    }
  }

  const loadQuotations = async () => {
    setIsLoading(true)
    setMessage("")

    try {
      const params = branchId ? { branchId } : {}
      const response = await getQuotations(params)
      const rows = getQuotationRows(response)

      setQuotations(rows)

      if (rows.length === 0) {
        setMessage("No quotations found yet for this branch.")
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
  }

  const resetQuotationForm = () => {
    setEditingQuotationId("")
    setFormTitle("")
    setFormNotes("")
    setFormInternalNotes("")
    setFormValidUntil("")
    setFormIsPcBuild(false)
    setFormQuotationType("MIXED")
    setSelectedCustomerId("")
    setSelectedServiceDoneById("")
    setCustomerSearch("")
    setIsCustomerSearchOpen(false)
    setLineDescription("")
    setLineQuantity("1")
    setLineUnitPrice("")
    setLineMarkup("")
    setLineDiscount("0")
    setLineRemarks("")
    setSelectedItemId("")
    setSelectedItemPriceTier("1")
    setProductSearch("")
    setIsProductSearchOpen(false)
    setProductQuantity("1")
    setProductMarkup("")
    setProductDiscount("0")
    setProductRemarks("")
    setQuotationLines([])
    setFormMessage("")
  }

  const openNewQuotationForm = () => {
    resetQuotationForm()
    setIsFormOpen(true)

    window.setTimeout(() => {
      formPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }, 100)
  }

  const openEditQuotationForm = () => {
    if (!selectedQuotation?.id || selectedQuotation.status !== "DRAFT") return

    const detailLines = (selectedQuotation.items || []).map((item, index) => {
      const quantity = Number(item.quantity || 0)
      const unitPrice = Number(item.unitPrice || 0)
      const discountAmount = Number(item.discountAmount || 0)

      return {
        localId: item.id || `existing-${index}`,
        type: item.itemId ? "PRODUCT" : "CUSTOM",
        itemId: item.itemId || undefined,
        description: item.description || item.itemNameSnapshot || "",
        itemCode: item.itemCodeSnapshot || item.item?.itemCode || "Custom/service line",
        priceTier: Number(item.priceTier || 1),
        quantity,
        baseUnitPrice:
          item.baseUnitPriceSnapshot == null
            ? unitPrice
            : Number(item.baseUnitPriceSnapshot),
        markupPercent:
          item.markupPercent == null
            ? ""
            : String(Number(item.markupPercent)),
        unitPrice,
        discountAmount,
        lineTotal: Number(item.lineTotal || quantity * unitPrice - discountAmount),
        remarks: item.remarks || "",
        isPcBuildPart: Boolean(item.isPcBuildPart),
      }
    })

    const hasProduct = detailLines.some((line) => line.type === "PRODUCT")
    const hasCustom = detailLines.some((line) => line.type === "CUSTOM")

    resetQuotationForm()
    setEditingQuotationId(selectedQuotation.id)
    setFormTitle(selectedQuotation.title || "")
    setFormNotes(selectedQuotation.notes || "")
    setFormInternalNotes(selectedQuotation.internalNotes || "")
    setFormValidUntil(
      selectedQuotation.validUntil
        ? new Date(selectedQuotation.validUntil).toISOString().slice(0, 10)
        : "",
    )
    setFormIsPcBuild(Boolean(selectedQuotation.isPcBuild))
    setFormQuotationType(hasProduct && hasCustom ? "MIXED" : hasCustom ? "SERVICE" : "PRODUCT")
    setSelectedCustomerId(selectedQuotation.customer?.id || "")
    setCustomerSearch(
      selectedQuotation.customer
        ? `${selectedQuotation.customer.customerCode} - ${selectedQuotation.customer.fullName}`
        : "",
    )
    setSelectedServiceDoneById(selectedQuotation.serviceDoneBy?.id || "")
    setQuotationLines(detailLines)
    setIsFormOpen(true)

    window.setTimeout(() => {
      formPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }, 100)
  }

  const handleProductSearchKeyDown = (event) => {
    if (event.key !== "Enter") return

    const search = productSearch.trim().toLowerCase()
    if (!search) return

    const exactMatch = availableItems.find((item) => {
      const code = String(item.itemCode || "").toLowerCase()
      const barcode = String(item.barcode || item.barcodeNo || item.sku || "").toLowerCase()

      return code === search || barcode === search
    })

    if (exactMatch) {
      setSelectedItemId(exactMatch.id)
      setProductSearch(`${exactMatch.itemCode} - ${exactMatch.itemName}`)
      setIsProductSearchOpen(false)
    }
  }

  const addProductLine = () => {
    if (!selectedItem) {
      setFormMessage("Select a product item first.")
      return
    }

    const quantity = Number(productQuantity || 0)
    const markupPercent =
      productMarkup === "" ? 0 : Number(productMarkup)
    const discountAmount = Number(productDiscount || 0)
    const grossTotal = quantity * selectedItemUnitPrice

    if (
      !Number.isFinite(markupPercent) ||
      markupPercent < 0 ||
      markupPercent >= 100
    ) {
      setFormMessage("Product mark up percentage must be from 0 up to less than 100.")
      return
    }

    if (quantity <= 0) {
      setFormMessage("Product quantity must be greater than zero.")
      return
    }

    if (discountAmount < 0) {
      setFormMessage("Product discount cannot be negative.")
      return
    }

    if (discountAmount > grossTotal) {
      setFormMessage("Product discount cannot exceed product line total.")
      return
    }

    const newLine = {
      localId: nextLocalLineId("product"),
      type: "PRODUCT",
      itemId: selectedItem.id,
      description: selectedItem.itemName,
      itemCode: selectedItem.itemCode,
      priceTier: Number(selectedItemPriceTier),
      quantity,
      baseUnitPrice: selectedItemBasePrice,
      markupPercent,
      unitPrice: selectedItemUnitPrice,
      discountAmount,
      lineTotal: Math.max(grossTotal - discountAmount, 0),
      remarks: productRemarks.trim(),
      isPcBuildPart: formIsPcBuild,
    }

    setQuotationLines((currentLines) => [...currentLines, newLine])
    setSelectedItemId("")
    setSelectedItemPriceTier("1")
    setProductSearch("")
    setIsProductSearchOpen(false)
    setProductQuantity("1")
    setProductMarkup("")
    setProductDiscount("0")
    setProductRemarks("")
    setFormMessage("")
  }

  const addCustomLine = () => {
    const description = lineDescription.trim()
    const quantity = Number(lineQuantity || 0)
    const baseUnitPrice = Number(lineUnitPrice || 0)
    const markupPercent = lineMarkup === "" ? 0 : Number(lineMarkup)
    const unitPrice = getServiceMarkupAdjustedPrice(baseUnitPrice, markupPercent)
    const discountAmount = Number(lineDiscount || 0)
    const grossTotal = quantity * unitPrice

    if (!description && unitPrice === 0) {
      setFormMessage("No custom/service line added. Fill description and amount, or add product line instead.")
      return
    }

    if (!description) {
      setFormMessage("Description is required for the custom/service line.")
      return
    }

    if (quantity <= 0) {
      setFormMessage("Custom/service quantity must be greater than zero.")
      return
    }

    if (!Number.isFinite(baseUnitPrice) || baseUnitPrice < 0) {
      setFormMessage("Custom/service base unit price cannot be negative.")
      return
    }

    if (
      !Number.isFinite(markupPercent) ||
      markupPercent < 0 ||
      markupPercent >= 100
    ) {
      setFormMessage("Custom/service mark up percentage must be from 0 up to less than 100.")
      return
    }

    if (discountAmount < 0) {
      setFormMessage("Custom/service discount cannot be negative.")
      return
    }

    if (discountAmount > grossTotal) {
      setFormMessage("Custom/service discount cannot exceed custom/service line total.")
      return
    }

    const newLine = {
      localId: nextLocalLineId("custom"),
      type: "CUSTOM",
      description,
      itemCode: "Custom/service line",
      priceTier: 1,
      quantity,
      baseUnitPrice,
      markupPercent,
      unitPrice,
      discountAmount,
      lineTotal: Math.max(grossTotal - discountAmount, 0),
      remarks: lineRemarks.trim(),
      isPcBuildPart: false,
    }

    setQuotationLines((currentLines) => [...currentLines, newLine])
    setLineDescription("")
    setLineQuantity("1")
    setLineUnitPrice("")
    setLineMarkup("")
    setLineDiscount("0")
    setLineRemarks("")
    setFormMessage("")
  }

  const removeQuotationLine = (localId) => {
    setQuotationLines((currentLines) => {
      const remainingLines = currentLines.filter((line) => line.localId !== localId)

      if (!remainingLines.some((line) => line.type === "CUSTOM")) {
        setSelectedServiceDoneById("")
      }

      return remainingLines
    })
  }

  const saveCustomQuotation = async () => {
    if (!branchId) {
      setFormMessage("Branch is required before saving quotation.")
      return
    }

    if (quotationLines.length === 0) {
      setFormMessage("Add at least one product or custom/service line before saving.")
      return
    }

    const invalidCustomMarkupLine = quotationLines.find((line) => {
      if (line.type !== "CUSTOM") return false
      const markupPercent = Number(line.markupPercent || 0)
      return !Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent >= 100
    })

    if (invalidCustomMarkupLine) {
      setFormMessage(
        `${invalidCustomMarkupLine.description || "Custom/service line"} needs a mark up percentage from 0 up to less than 100.`,
      )
      return
    }

    setIsSavingQuotation(true)
    setFormMessage("")

    try {
      const payload = {
        title: formTitle.trim(),
        notes: formNotes.trim(),
        internalNotes: formInternalNotes.trim(),
        isPcBuild: formIsPcBuild,
        customerId: selectedCustomerId || (editingQuotationId ? "" : undefined),
        items: quotationLines.map((line) => {
          if (line.type === "PRODUCT") {
            return {
              itemId: line.itemId,
              priceTier: line.priceTier,
              markupPercent:
                line.markupPercent === "" ||
                line.markupPercent === undefined ||
                line.markupPercent === null
                  ? 0
                  : Number(line.markupPercent),
              quantity: line.quantity,
              discountAmount: line.discountAmount,
              remarks: line.remarks,
              isPcBuildPart: line.isPcBuildPart,
            }
          }

          return {
            description: line.description,
            priceTier: 1,
            quantity: line.quantity,
            unitPrice: Number(line.baseUnitPrice ?? line.unitPrice),
            markupPercent:
              line.markupPercent === "" ||
              line.markupPercent === undefined ||
              line.markupPercent === null
                ? 0
                : Number(line.markupPercent),
            discountAmount: line.discountAmount,
            remarks: line.remarks,
            isPcBuildPart: false,
          }
        }),
      }

      if (formValidUntil) {
        payload.validUntil = new Date(`${formValidUntil}T23:59:59`).toISOString()
      }

      if (hasCustomServiceLines && selectedServiceDoneById) {
        payload.serviceDoneById = selectedServiceDoneById
      } else if (editingQuotationId) {
        payload.serviceDoneById = ""
      }

      if (!editingQuotationId) {
        payload.branchId = branchId
      }

      const response = editingQuotationId
        ? await updateQuotation(editingQuotationId, payload)
        : await createQuotation(payload)
      const savedQuotation = response?.data || response

      setFormMessage(
        editingQuotationId
          ? `Quotation updated successfully: ${savedQuotation?.quotationCode || "updated"}`
          : `Quotation saved successfully: ${savedQuotation?.quotationCode || "created"}`,
      )
      resetQuotationForm()
      setIsFormOpen(false)
      await loadQuotations()

      if (savedQuotation?.id) {
        await loadQuotationDetails(savedQuotation)
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        "Could not save quotation."

      setFormMessage(errorMessage)
    } finally {
      setIsSavingQuotation(false)
    }
  }

  const loadQuotationDetails = async (quotation) => {
    if (!quotation?.id) return

    setIsLoadingDetails(true)
    setDetailMessage("")

    try {
      const response = await getQuotationById(quotation.id)
      const detail = response?.data || response

      setSelectedQuotation(detail)
      setDetailServiceDoneById(detail?.serviceDoneById || detail?.serviceDoneBy?.id || "")
      setServiceDoneByMessage("")
      setIsPrintPreviewOpen(false)
      setIsConversionOpen(false)
      setConversionLines([])
      setConversionMessage("")
      setConvertedSale(null)
      conversionRequestRef.current = { signature: "", key: "" }

      setTimeout(() => {
        detailPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }, 100)
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        "Could not load quotation details."

      setSelectedQuotation(null)
      setDetailMessage(errorMessage)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const openQuotationConversion = async () => {
    if (!selectedQuotation?.id || selectedQuotation.status !== "APPROVED") return

    setIsConversionOpen(true)
    setIsLoadingConversionStock(true)
    setConversionMessage("")
    setConvertedSale(null)
    setConversionPaymentMethod("CASH")
    setConversionSettlementMethod("CASH")
    setConversionReferenceNo("")
    setConversionProviderReferenceNo("")
    setConversionCreditTerm("MONTH_3")
    setConversionCreditDueDay("")
    setConversionCreditFirstDueDate("")
    setConversionRemarks("")
    setConversionAmountPaid(String(Number(selectedQuotation.grandTotal || 0)))
    conversionRequestRef.current = { signature: "", key: "" }

    try {
      const preparedLineGroups = await Promise.all(
        (selectedQuotation.items || []).map(async (item) => {
          if (!item.itemId) {
            return [{
              ...item,
              conversionKey: `custom-${item.id || item.lineNo}`,
              batchId: "",
              serialId: "",
              availableBatches: [],
              availableSerials: [],
            }]
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
            return [{
              ...baseLine,
              conversionKey: `product-${item.id || item.lineNo}`,
            }]
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

      setConversionLines(preparedLineGroups.flat())
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        "Could not load inventory availability for quotation conversion."

      setConversionLines([])
      setConversionMessage(errorMessage)
    } finally {
      setIsLoadingConversionStock(false)
    }
  }

  const updateConversionLine = (lineId, field, value) => {
    setConversionLines((currentLines) =>
      currentLines.map((line) => {
        if (line.conversionKey !== lineId) return line

        if (field === "serialId") {
          const selectedSerial = line.availableSerials?.find((serial) => serial.id === value)

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

  const submitQuotationConversion = async () => {
    if (!selectedQuotation?.id || isConvertingQuotation) return

    const missingStockSelection = conversionLines.find((line) => {
      if (!line.itemId) return false
      return line.isSerialized ? !line.serialId : !line.batchId
    })

    if (missingStockSelection) {
      setConversionMessage(
        missingStockSelection.isSerialized
          ? `Select an available serial for ${missingStockSelection.description}.`
          : `Select an inventory batch for ${missingStockSelection.description}.`,
      )
      return
    }

    const amountPaid = Number(conversionAmountPaid || 0)
    const quotationTotal = Number(selectedQuotation.grandTotal || 0)

    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      setConversionMessage("Payment amount cannot be negative.")
      return
    }

    if (isConversionReceivable) {
      if (amountPaid >= quotationTotal) {
        setConversionMessage("A receivable conversion requires a positive outstanding balance.")
        return
      }

      if (isConversionInHouse && !selectedQuotation.customer?.id) {
        setConversionMessage("In-house installment requires a customer on the quotation.")
        return
      }

      if (isConversionInHouse && !conversionCreditTerm) {
        setConversionMessage("Select an installment term.")
        return
      }

      const dueDay =
        conversionCreditDueDay === ""
          ? null
          : Number(conversionCreditDueDay)

      if (
        isConversionInHouse &&
        dueDay !== null &&
        (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)
      ) {
        setConversionMessage("Installment due day must be a whole number from 1 to 31.")
        return
      }
    } else {
      if (amountPaid < quotationTotal) {
        setConversionMessage(
          "Immediate settlement must cover the quotation total, or select an AR provider.",
        )
        return
      }

      if (conversionPaymentMethod !== "CASH" && amountPaid > quotationTotal) {
        setConversionMessage("Only cash conversion can include overpayment and customer change.")
        return
      }
    }

    if (!window.confirm("Convert this approved quotation into a sale and deduct branch inventory?")) {
      return
    }

    setIsConvertingQuotation(true)
    setConversionMessage("")

    try {
      const salePayload = {
        branchId,
        customerId: selectedQuotation.customer?.id || undefined,
        quotationId: selectedQuotation.id,
        remarks: conversionRemarks.trim() || undefined,
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
          amountPaid > 0
            ? [
                {
                  paymentMethod: isConversionReceivable
                    ? conversionSettlementMethod
                    : conversionPaymentMethod,
                  amount: amountPaid,
                  referenceNo: conversionReferenceNo.trim() || undefined,
                  remarks: conversionRemarks.trim() || undefined,
                },
              ]
            : [],
        receivable: isConversionReceivable
          ? {
              provider: conversionPaymentMethod,
              providerReferenceNo:
                conversionProviderReferenceNo.trim() || undefined,
              ...(isConversionInHouse
                ? {
                    term: conversionCreditTerm,
                    dueDay:
                      conversionCreditDueDay === ""
                        ? undefined
                        : Number(conversionCreditDueDay),
                    firstDueDate: conversionCreditFirstDueDate
                      ? new Date(
                          `${conversionCreditFirstDueDate}T00:00:00+08:00`,
                        ).toISOString()
                      : undefined,
                  }
                : {}),
              remarks: conversionRemarks.trim() || undefined,
            }
          : undefined,
      }
      const requestSignature = JSON.stringify(salePayload)

      if (conversionRequestRef.current.signature !== requestSignature) {
        conversionRequestRef.current = {
          signature: requestSignature,
          key: createRequestKey(),
        }
      }

      const response = await createSale({
        ...salePayload,
        idempotencyKey: conversionRequestRef.current.key,
      })
      const sale = response?.data || response

      if (!sale?.id) throw new Error("Invalid sale response")

      setConvertedSale(sale)
      setConversionMessage(`Sale completed: ${sale?.receiptCode || "receipt created"}`)
      conversionRequestRef.current = { signature: "", key: "" }
      await loadQuotations()
      await loadQuotationDetails({ id: selectedQuotation.id })
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        "Could not convert quotation to sale."

      setConversionMessage(errorMessage)
    } finally {
      setIsConvertingQuotation(false)
    }
  }

  const saveServiceDoneByAssignment = async () => {
    if (!selectedQuotation?.id || selectedQuotation.status !== "DRAFT") return

    setIsSavingServiceDoneBy(true)
    setServiceDoneByMessage("")

    try {
      const response = await updateQuotation(selectedQuotation.id, {
        serviceDoneById: detailServiceDoneById || "",
      })
      const updatedQuotation = response?.data || response

      setSelectedQuotation(updatedQuotation)
      setDetailServiceDoneById(
        updatedQuotation?.serviceDoneById || updatedQuotation?.serviceDoneBy?.id || "",
      )
      setServiceDoneByMessage("Service Done By assignment saved.")
      await loadQuotations()
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        "Could not save Service Done By assignment."

      setServiceDoneByMessage(errorMessage)
    } finally {
      setIsSavingServiceDoneBy(false)
    }
  }

  const changeQuotationStatus = async (nextStatus) => {
    if (!selectedQuotation?.id || isUpdatingStatus) return

    let remarks = ""

    if (nextStatus === "CANCELLED") {
      const cancellationRemarks = window.prompt(
        "Cancellation remarks (recommended for the audit trail):",
        "",
      )

      if (cancellationRemarks === null) return
      remarks = cancellationRemarks.trim()

      if (!window.confirm("Cancel this quotation? This status change cannot be undone.")) {
        return
      }
    } else {
      const labels = {
        SENT: "mark this quotation as sent",
        APPROVED: "approve this quotation for conversion to a sale",
      }

      if (!window.confirm(`Confirm that you want to ${labels[nextStatus] || "update this quotation"}?`)) {
        return
      }
    }

    setIsUpdatingStatus(true)
    setStatusMessage("")

    try {
      const response = await updateQuotationStatus(selectedQuotation.id, {
        status: nextStatus,
        remarks,
      })
      const updatedQuotation = response?.data || response

      setSelectedQuotation(updatedQuotation)
      setDetailServiceDoneById(updatedQuotation?.serviceDoneBy?.id || "")
      setStatusMessage(`Quotation status updated to ${nextStatus.replaceAll("_", " ")}.`)
      setIsFormOpen(false)
      resetQuotationForm()
      await loadQuotations()
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        "Could not update quotation status."

      setStatusMessage(errorMessage)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      loadQuotations()
      loadAvailableServiceStaff()
      loadAvailableCustomers()
      loadAvailableItems()
    }, 0)

    return () => window.clearTimeout(loadTimer)

    // These loaders intentionally refresh when the authenticated branch context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--color-maroon)]">
          Quotations
        </p>

        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="brand-text text-3xl font-bold text-[var(--color-text-strong)]">
              Quotation Module
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
              Create product, service, and mixed quotations before converting them to sales.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm">
            <p className="font-bold text-[var(--color-text-strong)]">{branchName}</p>
            <p className="text-xs text-[var(--color-muted)]">
              {filteredQuotations.length} of {quotations.length} quotation{quotations.length === 1 ? "" : "s"} shown
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Total quotations
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text-strong)]">
            {filteredQuotations.length}
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Total quoted amount
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text-strong)]">
            ₱{money(totalQuotationAmount)}
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Status
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--color-text-strong)]">
            {isLoading ? "Loading quotations..." : "Backend list connected"}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-strong)]">
              Quotation list
            </h2>
            <p className="text-sm text-[var(--color-muted)]">
              Product, service, and mixed quotations will appear here.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)] focus:bg-white"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="ALL">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="APPROVED">Approved</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="CONVERTED">Converted</option>
            </select>

            <button
              className="rounded-2xl border border-[var(--color-border)] bg-white px-5 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
              disabled={isLoading}
              onClick={loadQuotations}
              type="button"
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              className="rounded-2xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:opacity-90"
              onClick={openNewQuotationForm}
              type="button"
            >
              New quotation
            </button>
          </div>
        </div>

        {message ? (
          <div className="m-5 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-soft)] p-5 text-sm text-[var(--color-muted)]">
            {message}
          </div>
        ) : null}

        {isLoading ? (
          <div className="p-5 text-sm text-[var(--color-muted)]">Loading quotations...</div>
        ) : null}

        {!isLoading && filteredQuotations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                <tr>
                  <th className="px-5 py-4">Quotation no.</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Lines</th>
                  <th className="px-5 py-4">Prepared by</th>
                  <th className="px-5 py-4 text-right">Amount</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.map((quotation) => (
                  <tr
                    className="border-t border-[var(--color-border)] text-[var(--color-text)]"
                    key={quotation.id || quotation.quotationCode}
                  >
                    <td className="px-5 py-4 font-bold text-[var(--color-text-strong)]">
                      {quotation.quotationCode || quotation.code || "—"}
                    </td>
                    <td className="px-5 py-4">
                      {quotation.customer?.fullName || quotation.customerName || "Walk-in / No customer"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-bold text-[var(--color-text-strong)]">
                        {quotation.status || "DRAFT"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-[var(--color-text-strong)]">
                      {getItemCount(quotation)}
                    </td>
                    <td className="px-5 py-4">
                      {quotation.preparedBy?.fullName || quotation.preparedByName || "—"}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-[var(--color-text-strong)]">
                      ₱{money(quotation.grandTotal || quotation.totalAmount)}
                    </td>
                    <td className="px-5 py-4">
                      {formatDate(quotation.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
                        disabled={isLoadingDetails}
                        onClick={() => loadQuotationDetails(quotation)}
                        type="button"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!isLoading && quotations.length > 0 && filteredQuotations.length === 0 ? (
          <div className="m-5 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-soft)] p-5 text-sm text-[var(--color-muted)]">
            No quotations match the selected status filter.
          </div>
        ) : null}
      </div>

      {isFormOpen ? (
        <div
          className="rounded-3xl border border-[var(--color-border)] bg-white shadow-card"
          ref={formPanelRef}
        >
          <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-maroon)]">
                {editingQuotationId ? "Edit quotation" : "New quotation"}
              </p>
              <h2 className="mt-2 text-xl font-bold text-[var(--color-text-strong)]">
                {editingQuotationId ? "Update draft quotation" : "Create quotation"}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Product prices are recalculated by the backend from the selected tier.
              </p>
            </div>

            <button
              className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
              onClick={() => {
                setIsFormOpen(false)
                resetQuotationForm()
              }}
              type="button"
            >
              Close form
            </button>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Quotation type
              </span>
              <select
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)] focus:bg-white"
                onChange={(event) => setFormQuotationType(event.target.value)}
                value={formQuotationType}
              >
                <option value="PRODUCT">Product only</option>
                <option value="SERVICE">Service only</option>
                <option value="MIXED">Mixed product + service</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Branch
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none"
                disabled
                value={branchName}
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Customer
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                onChange={(event) => {
                  setCustomerSearch(event.target.value)
                  setIsCustomerSearchOpen(true)
                  if (!event.target.value.trim()) {
                    setSelectedCustomerId("")
                  }
                }}
                onFocus={() => setIsCustomerSearchOpen(true)}
                placeholder={isLoadingCustomers ? "Loading customers..." : "Walk-in / search customer"}
                value={customerSearch}
              />

              {isCustomerSearchOpen && customerSearch.trim() ? (
                <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-white shadow-card">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.slice(0, 12).map((customer) => (
                      <button
                        className="block w-full border-b border-[var(--color-border)] px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-[var(--color-soft)]"
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomerId(customer.id)
                          setCustomerSearch(`${customer.customerCode} - ${customer.fullName}`)
                          setIsCustomerSearchOpen(false)
                        }}
                        type="button"
                      >
                        <span className="block font-bold text-[var(--color-text-strong)]">
                          {customer.customerCode} - {customer.fullName}
                        </span>
                        <span className="mt-1 block text-xs text-[var(--color-muted)]">
                          {customer.mobileNumber || "No mobile"} • {customer.companyName || customer.email || "No company/email"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-[var(--color-muted)]">
                      No matching customer found. Walk-in is still allowed.
                    </div>
                  )}
                </div>
              ) : null}

              {selectedCustomer ? (
                <div className="mt-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3 text-xs text-[var(--color-muted)]">
                  Selected: <span className="font-bold text-[var(--color-text-strong)]">{selectedCustomer.fullName}</span>
                  {selectedCustomer.mobileNumber ? ` • ${selectedCustomer.mobileNumber}` : ""}
                </div>
              ) : null}

              {customerMessage ? (
                <div className="mt-2 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-soft)] p-3 text-xs text-[var(--color-muted)]">
                  {customerMessage}
                </div>
              ) : null}
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Prepared by
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none"
                disabled
                value={user?.fullName || user?.username || "Current user"}
              />
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Prepared by is automatic based on the logged-in account.
              </p>
            </label>

            {hasCustomServiceLines ? (
              <label className="block md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Service done by (optional)
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                  disabled={isLoadingServiceStaff}
                  onChange={(event) => setSelectedServiceDoneById(event.target.value)}
                  value={selectedServiceDoneById}
                >
                  <option value="">
                    {isLoadingServiceStaff ? "Loading eligible staff..." : "Not assigned"}
                  </option>
                  {availableServiceStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.fullName} ({staff.role})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  One branch staff member for all custom/service lines in this quotation.
                </p>
                {serviceStaffMessage ? (
                  <p className="mt-2 text-xs font-semibold text-[var(--color-maroon)]">
                    {serviceStaffMessage}
                  </p>
                ) : null}
              </label>
            ) : null}
          </div>

          <div className="grid gap-4 border-t border-[var(--color-border)] p-5 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Quotation title
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                onChange={(event) => setFormTitle(event.target.value)}
                placeholder="Example: PC build quotation / service estimate"
                type="text"
                value={formTitle}
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Customer notes
              </span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                onChange={(event) => setFormNotes(event.target.value)}
                placeholder="Notes visible for quotation record"
                value={formNotes}
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Internal notes
              </span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                onChange={(event) => setFormInternalNotes(event.target.value)}
                placeholder="Internal staff notes only"
                value={formInternalNotes}
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Valid until
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                onChange={(event) => setFormValidUntil(event.target.value)}
                type="date"
                value={formValidUntil}
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3">
              <input
                checked={formIsPcBuild}
                className="size-4"
                onChange={(event) => setFormIsPcBuild(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-bold text-[var(--color-text-strong)]">
                  PC build quotation
                </span>
                <span className="block text-xs text-[var(--color-muted)]">
                  Use this for full PC set quotations with build/install defaults later.
                </span>
              </span>
            </label>
          </div>

          {canShowProductSection ? (
          <div className="border-t border-[var(--color-border)] p-5">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-maroon)]">
                Product item line preview
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Select an inventory item and price tier. Saving product line will be enabled after this preview is verified.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="block md:col-span-4">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Search / scan barcode
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                  onChange={(event) => {
                    setProductSearch(event.target.value)
                    setIsProductSearchOpen(true)
                  }}
                  onFocus={() => setIsProductSearchOpen(true)}
                  onKeyDown={handleProductSearchKeyDown}
                  placeholder={
                    isLoadingItems ? "Loading product items..." : "Scan barcode or search item code/name"
                  }
                  type="text"
                  value={productSearch}
                />
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Barcode scanner can type here then press Enter automatically.
                </p>

                {isProductSearchOpen && productSearch.trim() ? (
                  <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-white shadow-card">
                    {filteredProductItems.length > 0 ? (
                      filteredProductItems.slice(0, 12).map((item) => (
                        <button
                          className="block w-full border-b border-[var(--color-border)] px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-[var(--color-soft)]"
                          key={item.id}
                          onClick={() => {
                            setSelectedItemId(item.id)
                            setProductSearch(`${item.itemCode} - ${item.itemName}`)
                            setIsProductSearchOpen(false)
                          }}
                          type="button"
                        >
                          <span className="block font-bold text-[var(--color-text-strong)]">
                            {item.itemCode} - {item.itemName}
                          </span>
                          <span className="mt-1 block text-xs text-[var(--color-muted)]">
                            Price 1: ₱{money(item.price1)} • Price 2: ₱{money(item.price2)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-[var(--color-muted)]">
                        No matching product item found.
                      </div>
                    )}
                  </div>
                ) : null}
              </label>


              <label className="block md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Price tier
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                  onChange={(event) => setSelectedItemPriceTier(event.target.value)}
                  value={selectedItemPriceTier}
                >
                  <option value="1">Price 1</option>
                  <option value="2">Price 2</option>
                  <option value="3">Price 3</option>
                  <option value="4">Price 4</option>
                  <option value="5">Price 5</option>
                </select>
              </label>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Base price
                </p>
                <p className="mt-1 text-xl font-bold text-[var(--color-text-strong)]">
                  ₱{money(selectedItemBasePrice)}
                </p>
                <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
                  Final unit price: ₱{money(selectedItemUnitPrice)}
                </p>
              </div>
            </div>

            {selectedItem ? (
              <div className="mt-4 space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-sm">
                <div>
                  <p className="font-bold text-[var(--color-text-strong)]">
                    {selectedItem.itemName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {selectedItem.itemCode} • Price tier is visible in system only. Customer copy later shows final price only.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-5">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Product qty
                    </span>
                    <input
                      className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                      min="0"
                      onChange={(event) => setProductQuantity(event.target.value)}
                      type="number"
                      value={productQuantity}
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Mark up %
                    </span>
                    <input
                      className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                      max="99.9999"
                      min="0"
                      onChange={(event) => setProductMarkup(event.target.value)}
                      placeholder="Optional"
                      step="0.01"
                      type="number"
                      value={productMarkup}
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Product discount
                    </span>
                    <input
                      className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                      min="0"
                      onChange={(event) => setProductDiscount(event.target.value)}
                      type="number"
                      value={productDiscount}
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Product remarks
                    </span>
                    <input
                      className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                      onChange={(event) => setProductRemarks(event.target.value)}
                      placeholder="Optional"
                      type="text"
                      value={productRemarks}
                    />
                  </label>

                  <div className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      Product line total
                    </p>
                    <p className="mt-1 text-xl font-bold text-[var(--color-text-strong)]">
                      ₱{money(productNetTotal)}
                    </p>
                  </div>
                </div>

                <button
                  className="rounded-2xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:opacity-90"
                  onClick={addProductLine}
                  type="button"
                >
                  Add product line
                </button>
              </div>
            ) : null}

            {!selectedItem && productSearch && filteredProductItems.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-sm text-[var(--color-muted)]">
                No product item matched the search/scan input.
              </div>
            ) : null}

            {itemMessage ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-sm text-[var(--color-muted)]">
                {itemMessage}
              </div>
            ) : null}
          </div>
          ) : null}

          {canShowCustomSection ? (
          <div className="border-t border-[var(--color-border)] p-5">
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-maroon)]">
                First custom / service line
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Use this for service quotation, labor, delivery, transpo, home service, or custom line.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              <label className="block md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Description
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                  onChange={(event) => setLineDescription(event.target.value)}
                  placeholder="Example: Installation service / delivery charge"
                  type="text"
                  value={lineDescription}
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Quantity
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                  min="0"
                  onChange={(event) => setLineQuantity(event.target.value)}
                  type="number"
                  value={lineQuantity}
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Base unit price
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                  min="0"
                  onChange={(event) => setLineUnitPrice(event.target.value)}
                  type="number"
                  value={lineUnitPrice}
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Mark up %
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                  max="99.9999"
                  min="0"
                  onChange={(event) => setLineMarkup(event.target.value)}
                  placeholder="Optional"
                  step="0.01"
                  type="number"
                  value={lineMarkup}
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Discount amount
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                  min="0"
                  onChange={(event) => setLineDiscount(event.target.value)}
                  type="number"
                  value={lineDiscount}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Remarks
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                  onChange={(event) => setLineRemarks(event.target.value)}
                  placeholder="Optional line remarks"
                  type="text"
                  value={lineRemarks}
                />
              </label>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Line total preview
                </p>
                <p className="mt-1 text-xl font-bold text-[var(--color-text-strong)]">
                  ₱{money(lineNetTotal)}
                </p>
                <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
                  Base ₱{money(lineBaseUnitPrice)} • Final unit price ₱{money(lineFinalUnitPrice)}
                </p>
              </div>
            </div>

            <button
              className="mt-4 rounded-2xl border border-[var(--color-border)] bg-white px-5 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
              onClick={addCustomLine}
              type="button"
            >
              Add custom/service line
            </button>
          </div>
          ) : null}

          {quotationLines.length > 0 ? (
            <div className="border-t border-[var(--color-border)] p-5">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-maroon)]">
                    Quotation lines to save
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    These lines will be saved together in one quotation.
                  </p>
                </div>
                <p className="text-xl font-bold text-[var(--color-text-strong)]">
                  ₱{money(quotationLinesTotal)}
                </p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
                <table className="w-full min-w-[1120px] text-left text-sm">
                  <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    <tr>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Price tier</th>
                      <th className="px-4 py-3 text-right">Base</th>
                      <th className="px-4 py-3 text-right">Mark up</th>
                      <th className="px-4 py-3 text-right">Final</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Discount</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotationLines.map((line) => (
                      <tr className="border-t border-[var(--color-border)]" key={line.localId}>
                        <td className="px-4 py-3 font-bold text-[var(--color-text-strong)]">
                          {line.type === "PRODUCT" ? "Product" : "Custom/service"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-[var(--color-text-strong)]">{line.description}</p>
                          <p className="text-xs text-[var(--color-muted)]">{line.itemCode || "—"}</p>
                        </td>
                        <td className="px-4 py-3">
                          {line.type === "PRODUCT" ? <p>Price {line.priceTier}</p> : <p>—</p>}
                        </td>
                        <td className="px-4 py-3 text-right">₱{money(line.baseUnitPrice ?? line.unitPrice)}</td>
                        <td className="px-4 py-3 text-right">{Number(line.markupPercent || 0)}%</td>
                        <td className="px-4 py-3 text-right">₱{money(line.unitPrice)}</td>
                        <td className="px-4 py-3 text-right">{line.quantity}</td>
                        <td className="px-4 py-3 text-right">₱{money(line.discountAmount)}</td>
                        <td className="px-4 py-3 text-right font-bold text-[var(--color-text-strong)]">₱{money(line.lineTotal)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
                            onClick={() => removeQuotationLine(line.localId)}
                            type="button"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {formMessage ? (
            <div className="border-t border-[var(--color-border)] bg-[var(--color-soft)] p-5 text-sm font-semibold text-[var(--color-text-strong)]">
              {formMessage}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-[var(--color-border)] bg-[var(--color-soft)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--color-muted)]">
              Save requires at least one product or custom/service line in the quotation lines table.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                className="rounded-2xl border border-[var(--color-border)] bg-white px-5 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
                onClick={resetQuotationForm}
                type="button"
              >
                {editingQuotationId ? "Reset edit" : "Clear form"}
              </button>

              <button
                className="rounded-2xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSavingQuotation}
                onClick={saveCustomQuotation}
                type="button"
              >
                {isSavingQuotation
                  ? "Saving..."
                  : editingQuotationId
                    ? "Update quotation"
                    : "Save quotation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailMessage ? (
        <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-soft)] p-5 text-sm text-[var(--color-muted)]">
          {detailMessage}
        </div>
      ) : null}

      {isLoadingDetails ? (
        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-6 text-sm text-[var(--color-muted)] shadow-card">
          Loading quotation details...
        </div>
      ) : null}

      {selectedQuotation ? (
        <div
          className="rounded-3xl border border-[var(--color-border)] bg-white shadow-card"
          ref={detailPanelRef}
        >
          <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-maroon)]">
                Quotation details
              </p>
              <h2 className="mt-2 text-xl font-bold text-[var(--color-text-strong)]">
                {selectedQuotation.quotationCode || "Quotation"}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Customer: {selectedQuotation.customer?.fullName || "Walk-in / No customer"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-bold text-[var(--color-text-strong)]">
                  {getItemCount(selectedQuotation)} line{getItemCount(selectedQuotation) === 1 ? "" : "s"}
                </span>
                {selectedQuotation.isPcBuild ? (
                  <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-bold text-[var(--color-maroon)]">
                    PC build quotation
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedQuotation.status === "APPROVED" ? (
                <button
                  className="rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800"
                  onClick={openQuotationConversion}
                  type="button"
                >
                  Convert to sale
                </button>
              ) : null}
              {selectedQuotation.status === "DRAFT" ? (
                <button
                  className="rounded-2xl border border-[var(--color-maroon)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-maroon)] transition hover:bg-[var(--color-soft)]"
                  onClick={openEditQuotationForm}
                  type="button"
                >
                  Edit draft
                </button>
              ) : null}
              <button
                className="rounded-2xl bg-[var(--color-maroon)] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
                onClick={() => setIsPrintPreviewOpen(true)}
                type="button"
              >
                Print customer copy
              </button>
              <button
                className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
                onClick={() => {
                  setSelectedQuotation(null)
                  setIsPrintPreviewOpen(false)
                  setStatusMessage("")
                }}
                type="button"
              >
                Close details
              </button>
            </div>
          </div>

          <div className="grid gap-4 border-b border-[var(--color-border)] p-5 md:grid-cols-3 xl:grid-cols-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Status</p>
              <p className="mt-1 font-bold text-[var(--color-text-strong)]">{selectedQuotation.status || "DRAFT"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Prepared by</p>
              <p className="mt-1 font-bold text-[var(--color-text-strong)]">{selectedQuotation.preparedBy?.fullName || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Service done by</p>
              <p className="mt-1 font-bold text-[var(--color-text-strong)]">{selectedQuotation.serviceDoneBy?.fullName || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Subtotal</p>
              <p className="mt-1 font-bold text-[var(--color-text-strong)]">₱{money(selectedQuotation.subtotal)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Grand total</p>
              <p className="mt-1 font-bold text-[var(--color-text-strong)]">₱{money(selectedQuotation.grandTotal)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Valid until</p>
              <p className="mt-1 font-bold text-[var(--color-text-strong)]">{formatDate(selectedQuotation.validUntil)}</p>
            </div>
          </div>

          {selectedQuotation.status === "DRAFT" || selectedQuotation.status === "SENT" ? (
            <div className="flex flex-col gap-3 border-b border-[var(--color-border)] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-[var(--color-text-strong)]">Quotation workflow</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Status changes are recorded and cannot be rolled back through normal editing.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedQuotation.status === "DRAFT" ? (
                  <button
                    className="rounded-2xl bg-[var(--color-maroon)] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isUpdatingStatus}
                    onClick={() => changeQuotationStatus("SENT")}
                    type="button"
                  >
                    Mark as sent
                  </button>
                ) : null}
                {selectedQuotation.status === "SENT" ? (
                  <button
                    className="rounded-2xl bg-[var(--color-maroon)] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isUpdatingStatus}
                    onClick={() => changeQuotationStatus("APPROVED")}
                    type="button"
                  >
                    Approve quotation
                  </button>
                ) : null}
                <button
                  className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isUpdatingStatus}
                  onClick={() => changeQuotationStatus("CANCELLED")}
                  type="button"
                >
                  Cancel quotation
                </button>
              </div>
            </div>
          ) : null}

          {statusMessage ? (
            <div className="border-b border-[var(--color-border)] bg-[var(--color-soft)] px-5 py-3 text-sm font-semibold text-[var(--color-text-strong)]">
              {statusMessage}
            </div>
          ) : null}

          {isConversionOpen ? (
            <div className="border-b border-[var(--color-border)] bg-[var(--color-soft)] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                    Quotation conversion
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-[var(--color-text-strong)]">
                    Select fulfillment stock and payment
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                    The backend validates quotation lines, prices, serial availability, branch stock, payment, and duplicate conversion.
                  </p>
                </div>
                <button
                  className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-text-strong)]"
                  disabled={isConvertingQuotation}
                  onClick={() => setIsConversionOpen(false)}
                  type="button"
                >
                  Close conversion
                </button>
              </div>
{isLoadingConversionStock ? (
                <p className="mt-4 text-sm text-[var(--color-muted)]">Loading branch batches and serials...</p>
              ) : null}

              {!isLoadingConversionStock && conversionLines.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {conversionLines.map((line) => (
                    <div
                      className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)] md:items-center"
                      key={line.conversionKey}
                    >
                      <div>
                        <p className="font-bold text-[var(--color-text-strong)]">{line.description}</p>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          Qty {Number(line.quantity || 0)} • ₱{money(line.lineTotal)}
                          {line.unitSequence
                            ? ` • Serial unit ${line.unitSequence} of ${line.originalQuantity}`
                            : ""}
                        </p>
                      </div>

                      {!line.itemId ? (
                        <p className="text-sm font-semibold text-[var(--color-muted)]">
                          Service/custom line — no inventory deduction
                        </p>
                      ) : line.isSerialized ? (
                        <div>
                          <select
                            className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)] disabled:bg-red-50 disabled:text-red-700"
                            disabled={(line.availableSerials || []).length === 0}
                            onChange={(event) =>
                              updateConversionLine(line.conversionKey, "serialId", event.target.value)
                            }
                            value={line.serialId}
                          >
                            <option value="">
                              {(line.availableSerials || []).length === 0
                                ? "⚠️ No available serials in stock"
                                : "Select available serial"}
                            </option>
                            {(line.availableSerials || []).map((serial) => (
                              <option
                                disabled={conversionLines.some(
                                  (otherLine) =>
                                    otherLine.conversionKey !== line.conversionKey &&
                                    otherLine.serialId === serial.id,
                                )}
                                key={serial.id}
                                value={serial.id}
                              >
                                {serial.serialNumber} • {serial.batch?.batchCode || "No batch"}
                              </option>
                            ))}
                          </select>
                          {(line.availableSerials || []).length === 0 ? (
                            <p className="mt-1 text-xs font-bold text-red-600">
                              Out of stock: 0 available serials in this branch.
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div>
                          <select
                            className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)] disabled:bg-red-50 disabled:text-red-700"
                            disabled={(line.availableBatches || []).length === 0}
                            onChange={(event) =>
                              updateConversionLine(line.conversionKey, "batchId", event.target.value)
                            }
                            value={line.batchId}
                          >
                            <option value="">
                              {(line.availableBatches || []).length === 0
                                ? "⚠️ No stock batches available"
                                : "Select active batch"}
                            </option>
                            {(line.availableBatches || []).map((batch) => (
                              <option key={batch.id} value={batch.id}>
                                {batch.batchCode} • {Number(batch.quantityAvailable || 0)} available
                              </option>
                            ))}
                          </select>
                          {(line.availableBatches || []).length === 0 ? (
                            <p className="mt-1 text-xs font-bold text-red-600">
                              Out of stock: 0 available quantity in this branch.
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                        Settlement arrangement
                      </span>
                      <select
                        className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
                        onChange={(event) => {
                          const nextMethod = event.target.value
                          setConversionPaymentMethod(nextMethod)
                          setConversionAmountPaid(
                            RECEIVABLE_PROVIDER_VALUES.has(nextMethod)
                              ? "0"
                              : String(Number(selectedQuotation.grandTotal || 0)),
                          )
                        }}
                        value={conversionPaymentMethod}
                      >
                        <optgroup label="Immediate settlement">
                          {IMMEDIATE_PAYMENT_METHODS.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Accounts receivable">
                          {RECEIVABLE_PROVIDERS.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </optgroup>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                        {isConversionReceivable
                          ? "Immediate settlement / downpayment"
                          : "Amount paid"}
                      </span>
                      <input
                        className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
                        max={
                          isConversionReceivable || conversionPaymentMethod !== "CASH"
                            ? Number(selectedQuotation.grandTotal || 0)
                            : undefined
                        }
                        min="0"
                        onChange={(event) => setConversionAmountPaid(event.target.value)}
                        step="0.01"
                        type="number"
                        value={conversionAmountPaid}
                      />
                    </label>
                    {isConversionReceivable ? (
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                          Immediate settlement method
                        </span>
                        <select
                          className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
                          onChange={(event) => setConversionSettlementMethod(event.target.value)}
                          value={conversionSettlementMethod}
                        >
                          {IMMEDIATE_PAYMENT_METHODS.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {isConversionReceivable ? (
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                          Provider reference
                        </span>
                        <input
                          className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
                          onChange={(event) => setConversionProviderReferenceNo(event.target.value)}
                          placeholder="Optional provider approval/reference"
                          value={conversionProviderReferenceNo}
                        />
                      </label>
                    ) : null}
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                        Settlement reference
                      </span>
                      <input
                        className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
                        onChange={(event) => setConversionReferenceNo(event.target.value)}
                        placeholder="Optional"
                        value={conversionReferenceNo}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                        Remarks
                      </span>
                      <input
                        className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
                        onChange={(event) => setConversionRemarks(event.target.value)}
                        placeholder="Optional"
                        value={conversionRemarks}
                      />
                    </label>
                    {isConversionReceivable ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900 md:col-span-2 xl:col-span-4">
                        The unpaid quotation balance will open one receivable account. External financing supports walk-in customers; in-house installment requires the quotation customer and configured term pricing.
                      </div>
                    ) : null}
                    {isConversionInHouse ? (
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                          Installment term
                        </span>
                        <select
                          className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
                          onChange={(event) => setConversionCreditTerm(event.target.value)}
                          value={conversionCreditTerm}
                        >
                          {INSTALLMENT_TERMS.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {isConversionInHouse ? (
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                          Due day (optional)
                        </span>
                        <input
                          className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
                          max="31"
                          min="1"
                          onChange={(event) => setConversionCreditDueDay(event.target.value)}
                          step="1"
                          type="number"
                          value={conversionCreditDueDay}
                        />
                      </label>
                    ) : null}
                    {isConversionInHouse ? (
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                          First due date (optional)
                        </span>
                        <input
                          className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-3 text-sm outline-none focus:border-[var(--color-maroon)]"
                          onChange={(event) => setConversionCreditFirstDueDate(event.target.value)}
                          type="date"
                          value={conversionCreditFirstDueDate}
                        />
                      </label>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-[var(--color-text-strong)]">
                        Quotation total: ₱{money(selectedQuotation.grandTotal)}
                      </p>
                      {conversionMessage ? (
                        <p className="mt-1 text-sm font-semibold text-[var(--color-maroon)]">
                          {conversionMessage}
                        </p>
                      ) : null}
                      {convertedSale ? (
                        <p className="mt-1 text-xs text-emerald-700">
                          Receipt {convertedSale.receiptCode} • {convertedSale.paymentStatus}
                        </p>
                      ) : null}
                    </div>
                    <button
                      className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isConvertingQuotation || Boolean(convertedSale)}
                      onClick={submitQuotationConversion}
                      type="button"
                    >
                      {isConvertingQuotation ? "Converting..." : "Complete sale conversion"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {selectedQuotation.status === "DRAFT" && selectedQuotationHasCustomServiceLines ? (
            <div className="border-b border-[var(--color-border)] bg-[var(--color-soft)] p-5">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Update Service Done By
                  </span>
                  <select
                    className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isLoadingServiceStaff || isSavingServiceDoneBy}
                    onChange={(event) => setDetailServiceDoneById(event.target.value)}
                    value={detailServiceDoneById}
                  >
                    <option value="">
                      {isLoadingServiceStaff ? "Loading eligible staff..." : "Not assigned"}
                    </option>
                    {availableServiceStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.fullName} ({staff.role})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="rounded-2xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSavingServiceDoneBy}
                  onClick={saveServiceDoneByAssignment}
                  type="button"
                >
                  {isSavingServiceDoneBy ? "Saving..." : "Save assignment"}
                </button>
              </div>
              {serviceDoneByMessage ? (
                <p className="mt-3 text-sm font-semibold text-[var(--color-text-strong)]">
                  {serviceDoneByMessage}
                </p>
              ) : null}
              {serviceStaffMessage ? (
                <p className="mt-2 text-xs font-semibold text-[var(--color-maroon)]">
                  {serviceStaffMessage}
                </p>
              ) : null}
            </div>
          ) : null}

          {(selectedQuotation.notes || selectedQuotation.internalNotes) ? (
            <div className="grid gap-4 border-b border-[var(--color-border)] bg-[var(--color-soft)] p-5 md:grid-cols-2">
              {selectedQuotation.notes ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Customer notes</p>
                  <p className="mt-1 text-sm text-[var(--color-text-strong)]">{selectedQuotation.notes}</p>
                </div>
              ) : null}

              {selectedQuotation.internalNotes ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">Internal notes</p>
                  <p className="mt-1 text-sm text-[var(--color-text-strong)]">{selectedQuotation.internalNotes}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                <tr>
                  <th className="px-5 py-4">Line</th>
                  <th className="px-5 py-4">Description</th>
                  <th className="px-5 py-4">System price tier</th>
                  <th className="px-5 py-4 text-right">Base</th>
                  <th className="px-5 py-4 text-right">Mark up</th>
                  <th className="px-5 py-4 text-right">Final</th>
                  <th className="px-5 py-4 text-right">Qty</th>
                  <th className="px-5 py-4 text-right">Discount</th>
                  <th className="px-5 py-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(selectedQuotation.items || []).map((item) => (
                  <tr className="border-t border-[var(--color-border)]" key={item.id || item.lineNo}>
                    <td className="px-5 py-4 font-bold text-[var(--color-text-strong)]">{item.lineNo}</td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-[var(--color-text-strong)]">{item.description}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {item.itemCodeSnapshot || item.item?.itemCode || "Custom/service line"}
                        {item.isPcBuildPart ? " • PC build part" : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      {item.itemId ? (
                        <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-bold text-[var(--color-text-strong)]">
                          Price {item.priceTier || 1}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">₱{money(item.baseUnitPriceSnapshot ?? item.unitPrice)}</td>
                    <td className="px-5 py-4 text-right">{Number(item.markupPercent || 0)}%</td>
                    <td className="px-5 py-4 text-right">₱{money(item.unitPrice)}</td>
                    <td className="px-5 py-4 text-right">{Number(item.quantity || 0)}</td>
                    <td className="px-5 py-4 text-right">₱{money(item.discountAmount)}</td>
                    <td className="px-5 py-4 text-right font-bold text-[var(--color-text-strong)]">₱{money(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[var(--color-border)] bg-[var(--color-soft)] p-5 text-xs text-[var(--color-muted)]">
            System view only: price tier is visible here for staff control and history. The printed customer copy shows final prices only.
          </div>
        </div>
      ) : null}

      {isPrintPreviewOpen && selectedQuotation ? (
        <QuotationPrintPreview
          onClose={() => setIsPrintPreviewOpen(false)}
          quotation={selectedQuotation}
        />
      ) : null}
    </section>
  )
}

export default QuotationsPage




















