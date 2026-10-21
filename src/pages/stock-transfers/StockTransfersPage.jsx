import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  PackageCheck,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Truck,
  X,
} from "lucide-react"

import {
  dispatchStockTransfer,
  getStockTransferById,
  getStockTransfers,
  receiveStockTransfer,
  returnBorrowTransfer,
  updateStockTransferPricingById,
  updateStockTransferStatusById,
} from "../../features/stock-transfers/stockTransfers.api"
import { getInventorySerials } from "../../features/inventory/inventory.api"
import { getUser } from "../../lib/sessionStorage"
import SerialScannerModal from "../../components/common/SerialScannerModal"
import StockLoanSlipModal from "../../components/stock-transfers/StockLoanSlipModal"
import { exportReportExcel } from "../../utils/businessDocumentExport"
import ExportExcelButton from "../../components/common/ExportExcelButton"
import StockTransfersReportView from "./StockTransfersReportView"

function formatDate(value) {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
}

function formatQuantity(value) {
  return Number(value || 0).toLocaleString("en-PH")
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—"
  return Number(value).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  })
}

function extractSerialRows(response) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data?.data)) return response.data.data
  if (Array.isArray(response?.data?.items)) return response.data.items
  if (Array.isArray(response?.data?.records)) return response.data.records
  if (Array.isArray(response?.data)) return response.data
  if (Array.isArray(response?.items)) return response.items
  return []
}

function DirectionBadge({ transfer, activeBranchId }) {
  const isOut = Boolean(activeBranchId && transfer.fromBranchId === activeBranchId)
  const isIn = Boolean(activeBranchId && transfer.toBranchId === activeBranchId)

  if (isOut) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 whitespace-nowrap">
        <ArrowUpRight size={11} className="text-amber-600 shrink-0" /> Transfer Out
      </span>
    )
  }

  if (isIn) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800 whitespace-nowrap">
        <ArrowDownLeft size={11} className="text-sky-600 shrink-0" /> Transfer In
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 whitespace-nowrap">
      <ArrowLeftRight size={11} className="shrink-0" /> Transfer
    </span>
  )
}

function StatusBadge({ status, fulfillmentStatus }) {
  if (fulfillmentStatus === "IN_TRANSIT" && status !== "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-3 py-1 text-xs font-black text-sky-800">
        <Truck size={12} /> In Transit
      </span>
    )
  }

  const styles = {
    REQUESTED: "bg-amber-50 text-amber-700",
    APPROVED: "bg-blue-50 text-blue-700",
    REJECTED: "bg-rose-50 text-rose-700",
    POSTED: "bg-emerald-50 text-emerald-700",
    CANCELLED: "bg-gray-100 text-gray-600",
    DRAFT: "bg-slate-100 text-slate-700",
  }

  const formatted = String(status || "Unknown")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${styles[status] || styles.DRAFT}`}>{formatted}</span>
}

function isV2Transfer(transfer) {
  return transfer?.workflowVersion === 2 || Boolean(transfer?.fulfillmentMethod)
}

function WorkflowBadge({ transfer }) {
  if (isV2Transfer(transfer)) {
    return (
      <span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-black text-purple-700">
        V2
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
      Legacy
    </span>
  )
}

function isBorrowTransfer(transfer) {
  const combined = `${transfer?.notes || ""} ${transfer?.internalNotes || ""}`
  return combined.includes("[TRANSFER_TYPE:BORROW]")
}

function getBorrowStatus(transfer) {
  const combined = `${transfer?.notes || ""} ${transfer?.internalNotes || ""}`
  if (!combined.includes("[TRANSFER_TYPE:BORROW]")) return null
  if (combined.includes("[BORROW_STATUS:RETURNED]")) return "RETURNED"
  if (combined.includes("[BORROW_STATUS:PURCHASED]") || combined.includes("[BORROW_STATUS:CONVERTED_TO_PURCHASE]")) return "PURCHASED"
  return "ON_BORROW"
}

function ActionButtons({
  transfer,
  user,
  busy,
  onAction,
  onView,
  onReceive,
  onPrintLoanSlip,
  onReturnBorrow,
  onPurchaseBorrow,
}) {
  const isSuperOwner = user?.role === "SUPER_OWNER"
  const isSourceManager = isSuperOwner || transfer.fromBranchId === user?.branchId
  const isDestinationManager = isSuperOwner || transfer.toBranchId === user?.branchId
  const isLinkedManager = isSourceManager || isDestinationManager
  const isInTransit = transfer.fulfillmentStatus === "IN_TRANSIT"
  const isTerminal = ["POSTED", "REJECTED", "CANCELLED"].includes(transfer.status)
  const isBorrow = isBorrowTransfer(transfer)
  const borrowStatus = getBorrowStatus(transfer)
  const pricingComplete = (transfer.items || []).every(
    (item) => item.agreedTransferUnitPrice !== null && item.agreedTransferUnitPrice !== undefined
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition" onClick={() => onView(transfer)} type="button">
        <Eye size={13} /> Details
      </button>

      {isBorrow && onPrintLoanSlip ? (
        <button
          className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-800 hover:bg-purple-100 transition shadow-2xs"
          onClick={() => onPrintLoanSlip(transfer)}
          type="button"
          title="Print 2-Copy Inter-Branch Stock Borrow Slip"
        >
          <Printer size={13} /> Borrow Slip
        </button>
      ) : null}

      {isBorrow && borrowStatus === "ON_BORROW" && isLinkedManager && onReturnBorrow ? (
        <button
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
          disabled={busy}
          onClick={() => onReturnBorrow(transfer)}
          type="button"
          title="Isoli sa source branch (Mark as returned)"
        >
          <RotateCcw size={13} /> Isoli
        </button>
      ) : null}

      {isBorrow && borrowStatus === "ON_BORROW" && isLinkedManager && onPurchaseBorrow ? (
        <button
          className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800 hover:bg-blue-100 transition shadow-2xs"
          disabled={busy}
          onClick={() => onPurchaseBorrow(transfer)}
          type="button"
          title="Babayaran nalang ng destination branch (Convert to purchase)"
        >
          <CheckCircle2 size={13} /> Bayaran
        </button>
      ) : null}

      {isSourceManager && transfer.status === "DRAFT" ? (
        <button className="rounded-lg bg-[var(--color-maroon)] px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition" disabled={busy} onClick={() => onAction(transfer, "REQUESTED")} type="button">
          Request
        </button>
      ) : null}
      {isSourceManager && transfer.status === "REQUESTED" ? (
        <>
          <button className="rounded-lg bg-[var(--color-maroon)] px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || (!isBorrow && !pricingComplete)} onClick={() => onAction(transfer, "APPROVED")} title={!pricingComplete && !isBorrow ? "Set every agreed transfer price before approval" : undefined} type="button">
            Approve
          </button>
          <button className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 transition" disabled={busy} onClick={() => onAction(transfer, "REJECTED")} type="button">
            Reject
          </button>
        </>
      ) : null}
      {isSourceManager && transfer.status === "APPROVED" && !isInTransit ? (
        <button className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-amber-700 transition" disabled={busy} onClick={() => onAction(transfer, "DISPATCH")} type="button">
          Dispatch
        </button>
      ) : null}
      {isDestinationManager && isInTransit ? (
        <button className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition" disabled={busy} onClick={() => onReceive(transfer)} type="button">
          <PackageCheck size={13} /> Receive Stock
        </button>
      ) : null}
      {isLinkedManager && !isTerminal && !isInTransit ? (
        <button className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition" disabled={busy} onClick={() => onAction(transfer, "CANCELLED")} type="button">
          Cancel
        </button>
      ) : null}
    </div>
  )
}

export default function StockTransfersPage({ initialContext, selectedBranch, user: userProp }) {
  const user = userProp || getUser()
  const branchId = selectedBranch?.id || (user?.role === "SUPER_OWNER" ? "" : user?.branchId || "")
  const effectiveBranchId = branchId || user?.branchId || ""
  const [pageMode, setPageMode] = useState("operations") // "operations" | "reports"
  const [transfers, setTransfers] = useState([])
  const [pagination, setPagination] = useState(null)
  const [statusFilter, setStatusFilter] = useState("")
  const [directionFilter, setDirectionFilter] = useState("ALL") // "ALL" | "OUT" | "IN"
  const [searchText, setSearchText] = useState(initialContext?.search || "")
  const [page, setPage] = useState(1)
  const [selectedTransfer, setSelectedTransfer] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [actionTransferId, setActionTransferId] = useState("")
  const [pricingDrafts, setPricingDrafts] = useState({})
  const [borrowSubFilter, setBorrowSubFilter] = useState("ALL") // "ALL" | "ON_BORROW" | "RETURNED" | "PURCHASED"
  const [showLoanSlipModal, setShowLoanSlipModal] = useState(false)
  const [activeLoanTransfer, setActiveLoanTransfer] = useState(null)
  const [showReturnBorrowModal, setShowReturnBorrowModal] = useState(false)
  const [returnBorrowTarget, setReturnBorrowTarget] = useState(null)
  const [returnBorrowCondition, setReturnBorrowCondition] = useState("Good Condition")
  const [returnBorrowRemarks, setReturnBorrowRemarks] = useState("")
  const [isSubmittingReturnBorrow, setIsSubmittingReturnBorrow] = useState(false)
  const [showPurchaseBorrowModal, setShowPurchaseBorrowModal] = useState(false)
  const [purchaseBorrowTarget, setPurchaseBorrowTarget] = useState(null)
  const [purchaseBorrowRemarks, setPurchaseBorrowRemarks] = useState("")
  const [isSubmittingPurchaseBorrow, setIsSubmittingPurchaseBorrow] = useState(false)

  const isSelectedSourceManager = Boolean(
    selectedTransfer &&
      (user?.role === "SUPER_OWNER" || selectedTransfer.fromBranchId === user?.branchId)
  )
  const canEditSelectedPricing = Boolean(
    isSelectedSourceManager &&
      selectedTransfer &&
      ["DRAFT", "REQUESTED"].includes(selectedTransfer.status)
  )

  const loadTransfers = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const queryParams = {
        status: statusFilter || undefined,
        search: searchText.trim() || (directionFilter === "BORROW" ? "BORROW" : undefined),
        page,
        limit: 10,
      }

      if (effectiveBranchId) {
        if (directionFilter === "OUT") {
          queryParams.fromBranchId = effectiveBranchId
        } else if (directionFilter === "IN") {
          queryParams.toBranchId = effectiveBranchId
        } else {
          queryParams.branchId = effectiveBranchId
        }
      }

      const response = await getStockTransfers(queryParams)
      const result = response?.data || {}
      let items = Array.isArray(result.items) ? result.items : []
      if (directionFilter === "BORROW") {
        items = items.filter((item) => {
          if (!isBorrowTransfer(item)) return false
          const bStatus = getBorrowStatus(item)
          if (borrowSubFilter === "ON_BORROW") return bStatus === "ON_BORROW"
          if (borrowSubFilter === "RETURNED") return bStatus === "RETURNED"
          if (borrowSubFilter === "PURCHASED") return bStatus === "PURCHASED"
          return true
        })
      }
      setTransfers(items)
      setPagination(result.pagination || null)
    } catch (error) {
      setTransfers([])
      setPagination(null)
      setErrorMessage(error?.response?.data?.error?.message || "Could not load stock transfers.")
    } finally {
      setIsLoading(false)
    }
  }, [borrowSubFilter, directionFilter, effectiveBranchId, page, searchText, statusFilter])

  const handleOpenLoanSlip = async (transfer) => {
    try {
      const response = await getStockTransferById(transfer.id)
      const detail = response?.data || transfer
      setActiveLoanTransfer(detail)
      setShowLoanSlipModal(true)
    } catch {
      setActiveLoanTransfer(transfer)
      setShowLoanSlipModal(true)
    }
  }

  const handleOpenReturnBorrow = (transfer) => {
    setReturnBorrowTarget(transfer)
    setReturnBorrowCondition("Good Condition")
    setReturnBorrowRemarks("")
    setShowReturnBorrowModal(true)
  }

  const handleOpenPurchaseBorrow = (transfer) => {
    setPurchaseBorrowTarget(transfer)
    setPurchaseBorrowRemarks("")
    setShowPurchaseBorrowModal(true)
  }

  const handleConfirmPurchaseBorrow = async (event) => {
    if (event) event.preventDefault()
    if (!purchaseBorrowTarget) return

    setIsSubmittingPurchaseBorrow(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await returnBorrowTransfer(purchaseBorrowTarget.id, {
        actionType: "PURCHASE",
        remarks: purchaseBorrowRemarks,
      })
      setSuccessMessage(
        `Stock borrow ${purchaseBorrowTarget.transferCode} successfully marked as BABAYARAN NALANG (Converted to Purchase).`
      )
      setShowPurchaseBorrowModal(false)
      setPurchaseBorrowTarget(null)
      setPurchaseBorrowRemarks("")
      if (selectedTransfer?.id === purchaseBorrowTarget.id) {
        setSelectedTransfer(response?.data || null)
      }
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not convert borrowed stock to purchase."
      )
    } finally {
      setIsSubmittingPurchaseBorrow(false)
    }
  }

  const handleConfirmReturnBorrow = async (event) => {
    if (event) event.preventDefault()
    if (!returnBorrowTarget) return

    setIsSubmittingReturnBorrow(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await returnBorrowTransfer(returnBorrowTarget.id, {
        actionType: "RETURN",
        condition: returnBorrowCondition,
        remarks: returnBorrowRemarks,
      })
      setSuccessMessage(
        `Stock borrow ${returnBorrowTarget.transferCode} successfully marked as NASOLI NA (Returned).`
      )
      setShowReturnBorrowModal(false)
      setReturnBorrowTarget(null)
      setReturnBorrowCondition("Good Condition")
      setReturnBorrowRemarks("")
      if (selectedTransfer?.id === returnBorrowTarget.id) {
        setSelectedTransfer(response?.data || null)
      }
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not mark borrowed stock as returned."
      )
    } finally {
      setIsSubmittingReturnBorrow(false)
    }
  }

  const openTransfer = async (transfer) => {
    setSelectedTransfer(transfer)
    setIsLoadingDetail(true)
    try {
      const response = await getStockTransferById(transfer.id)
      const detail = response?.data || transfer
      setSelectedTransfer(detail)
      setPricingDrafts(
        Object.fromEntries(
          (detail.items || []).map((item) => [
            item.id,
            item.agreedTransferUnitPrice ?? item.proposedTransferUnitPrice ?? "",
          ])
        )
      )
    } catch (error) {
      setErrorMessage(error?.response?.data?.error?.message || "Could not load transfer details.")
    } finally {
      setIsLoadingDetail(false)
    }
  }

  useEffect(() => {
    if (!initialContext) return
    if (initialContext.search) {
      setSearchText(initialContext.search)
      setPage(1)
    }
    if (initialContext.transferId) {
      openTransfer({ id: initialContext.transferId })
    }
  }, [initialContext])

  const saveTransferPricing = async () => {
    if (!selectedTransfer) return

    const invalidPricingItem = (selectedTransfer.items || []).find((item) => {
      const rawValue = pricingDrafts[item.id]
      const value = Number(rawValue)

      return (
        rawValue === "" ||
        !Number.isFinite(value) ||
        value < 0 ||
        Math.abs(Math.round(value * 100) - value * 100) > 1e-8
      )
    })

    if (invalidPricingItem) {
      setErrorMessage("Every agreed transfer price must be nonnegative with at most two decimal places.")
      return
    }

    const pricingItems = (selectedTransfer.items || []).map((item) => {
      return {
        stockTransferItemId: item.id,
        agreedTransferUnitPrice: Number(pricingDrafts[item.id]),
      }
    })

    setActionTransferId(selectedTransfer.id)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await updateStockTransferPricingById(selectedTransfer.id, {
        items: pricingItems,
      })
      const updatedTransfer = response?.data || selectedTransfer
      setSelectedTransfer(updatedTransfer)
      setPricingDrafts(
        Object.fromEntries(
          (updatedTransfer.items || []).map((item) => [
            item.id,
            item.agreedTransferUnitPrice ?? "",
          ])
        )
      )
      setSuccessMessage(`${updatedTransfer.transferCode} agreed pricing was saved.`)
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not save agreed transfer pricing."
      )
    } finally {
      setActionTransferId("")
    }
  }

  const [isSerialModalOpen, setIsSerialModalOpen] = useState(false)
  const [serialModalTransfer, setSerialModalTransfer] = useState(null)
  const [serialModalItems, setSerialModalItems] = useState([])
  const [isFulfillingSerials, setIsFulfillingSerials] = useState(false)

  const updateTransferStatus = async (transfer, nextStatus, customPayload = null) => {
    const payload = customPayload || { status: nextStatus }

    if (!customPayload && (nextStatus === "REJECTED" || nextStatus === "CANCELLED")) {
      const label = nextStatus === "REJECTED" ? "rejecting" : "cancelling"
      const reason = window.prompt(`Reason for ${label} this transfer`)
      if (!reason?.trim()) {
        setErrorMessage(`${nextStatus === "REJECTED" ? "Rejection" : "Cancellation"} reason is required.`)
        return
      }
      payload[nextStatus === "REJECTED" ? "rejectionReason" : "cancellationReason"] = reason.trim()
    } else if (!customPayload && !window.confirm(`Confirm ${nextStatus.toLowerCase()} for ${transfer.transferCode}?`)) {
      return
    }

    setActionTransferId(transfer.id)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await updateStockTransferStatusById(transfer.id, payload)
      setSuccessMessage(`${response?.data?.transferCode || transfer.transferCode} is ${nextStatus.toLowerCase()}.`)
      if (selectedTransfer?.id === transfer.id) setSelectedTransfer(response?.data || null)
      await loadTransfers()
    } catch (error) {
      setErrorMessage(error?.response?.data?.error?.message || "Could not update stock transfer.")
    } finally {
      setActionTransferId("")
    }
  }

  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false)
  const [receiveModalTransfer, setReceiveModalTransfer] = useState(null)
  const [isReceiving, setIsReceiving] = useState(false)

  const handleOpenReceive = async (transfer) => {
    setActionTransferId(transfer.id)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await getStockTransferById(transfer.id)
      const detail = response?.data || transfer
      setReceiveModalTransfer(detail)
      setIsReceiveModalOpen(true)
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not load transfer details for receiving."
      )
    } finally {
      setActionTransferId("")
    }
  }

  const handleConfirmReceive = async () => {
    if (!receiveModalTransfer) return

    setIsReceiving(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await receiveStockTransfer(receiveModalTransfer.id, {})
      setSuccessMessage(
        `${response?.data?.transferCode || receiveModalTransfer.transferCode} successfully received and confirmed. Stock has been added to your branch inventory.`
      )
      setIsReceiveModalOpen(false)
      setReceiveModalTransfer(null)
      if (selectedTransfer?.id === receiveModalTransfer.id) {
        setSelectedTransfer(response?.data || null)
      }
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not confirm stock transfer receipt."
      )
    } finally {
      setIsReceiving(false)
    }
  }

  const handleAction = async (transfer, nextStatus) => {
    if (nextStatus === "DISPATCH" || nextStatus === "POSTED") {
      setActionTransferId(transfer.id)
      setErrorMessage("")
      setSuccessMessage("")

      try {
        const response = await getStockTransferById(transfer.id)
        const detail = response?.data || transfer
        const serializedLines = (detail.items || []).filter(
          (item) => item.item?.isSerialized || item.isSerialized
        )

        if (serializedLines.length > 0) {
          const fromBranchId = detail.fromBranchId || detail.fromBranch?.id || transfer.fromBranchId || transfer.fromBranch?.id
          const itemsWithSerials = await Promise.all(
            serializedLines.map(async (line) => {
              const itemId = line.itemId || line.item?.id
              const serialRes = await getInventorySerials({
                branchId: fromBranchId,
                itemId,
                status: "AVAILABLE",
                limit: 100,
              })
              let serialRows = extractSerialRows(serialRes)

              // Fallback: if no serials returned by itemId, try fetching by branchId + search itemCode
              if (serialRows.length === 0 && (line.item?.itemCode || line.itemCode)) {
                try {
                  const fallbackRes = await getInventorySerials({
                    branchId: fromBranchId,
                    search: line.item?.itemCode || line.itemCode,
                    status: "AVAILABLE",
                    limit: 100,
                  })
                  const fallbackRows = extractSerialRows(fallbackRes)
                  if (fallbackRows.length > 0) {
                    serialRows = fallbackRows
                  }
                } catch {
                  // ignore fallback error
                }
              }

              return {
                stockTransferItemId: line.id,
                itemId,
                itemName: line.item?.itemName || line.description || "Item",
                itemCode: line.item?.itemCode || "",
                requiredQuantity: Number(line.quantity || 1),
                availableSerials: serialRows,
              }
            })
          )

          setSerialModalTransfer(detail)
          setSerialModalItems(itemsWithSerials)
          setIsSerialModalOpen(true)
          return
        }

        if (!window.confirm(`Confirm dispatch for ${transfer.transferCode}? Stock will be deducted from source branch and marked in-transit.`)) {
          return
        }

        const dispatchRes = await dispatchStockTransfer(transfer.id, {})
        setSuccessMessage(`${dispatchRes?.data?.transferCode || transfer.transferCode} dispatched. Stock is now in transit.`)
        if (selectedTransfer?.id === transfer.id) setSelectedTransfer(dispatchRes?.data || null)
        await loadTransfers()
      } catch (error) {
        setErrorMessage(
          error?.response?.data?.error?.message ||
            error?.message ||
            "Could not dispatch stock transfer."
        )
      } finally {
        setActionTransferId("")
      }
      return
    }

    await updateTransferStatus(transfer, nextStatus)
  }

  const handleConfirmSerialFulfillment = async (selectedSerialsMap) => {
    if (!serialModalTransfer) return

    setIsFulfillingSerials(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const itemsPayload = Object.entries(selectedSerialsMap).map(
        ([stockTransferItemId, val]) => {
          if (Array.isArray(val)) {
            return {
              stockTransferItemId,
              serialIds: val,
              newSerialNumbers: [],
            }
          }
          return {
            stockTransferItemId,
            serialIds: val?.serialIds || [],
            newSerialNumbers: val?.newSerialNumbers || [],
          }
        }
      )

      const response = await dispatchStockTransfer(
        serialModalTransfer.id,
        {
          items: itemsPayload,
        }
      )

      setSuccessMessage(
        `${response?.data?.transferCode || serialModalTransfer.transferCode} successfully dispatched with assigned serial numbers. Stock is now in transit.`
      )
      setIsSerialModalOpen(false)
      setSerialModalTransfer(null)
      setSerialModalItems([])
      if (selectedTransfer?.id === serialModalTransfer.id) {
        setSelectedTransfer(response?.data || null)
      }
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not complete serial transfer dispatch."
      )
    } finally {
      setIsFulfillingSerials(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadTransfers, 250)
    return () => window.clearTimeout(timer)
  }, [loadTransfers])

  const handleExportTransfersExcel = async () => {
    try {
      const queryParams = {
        status: statusFilter || undefined,
        search: searchText.trim() || undefined,
      }
      if (effectiveBranchId) {
        if (directionFilter === "OUT") queryParams.fromBranchId = effectiveBranchId
        else if (directionFilter === "IN") queryParams.toBranchId = effectiveBranchId
        else queryParams.branchId = effectiveBranchId
      }

      const exportTransfers = []
      let exportPage = 1
      let totalPages = 1

      do {
        const response = await getStockTransfers({ ...queryParams, page: exportPage, limit: 50 })
        const result = response?.data || {}
        const pageItems = Array.isArray(result.items) ? result.items : []
        exportTransfers.push(...pageItems)
        totalPages = Math.max(1, Number(result.pagination?.totalPages || 1))
        exportPage += 1
      } while (exportPage <= totalPages)

      const exportColumns = [
        ["Transfer No", (row) => row.transferNumber || "—"],
        ["Date Requested", (row) => row.createdAt ? formatDate(row.createdAt) : "—"],
        ["Source Branch", (row) => row.fromBranch?.name || "—"],
        ["Destination Branch", (row) => row.toBranch?.name || "—"],
        ["Status", (row) => row.status || "—"],
        ["Items Count", (row) => (row.items || []).length],
        ["Total Units", (row) => (row.items || []).reduce((s, it) => s + Number(it.quantity || 0), 0)],
        ["Total Value", (row) => (row.items || []).reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.costPrice || 0)), 0)],
        ["Requested By", (row) => row.requestedBy?.fullName || row.requestedBy?.username || "—"],
        ["Received By", (row) => row.receivedBy?.fullName || row.receivedBy?.username || "—"],
        ["Remarks", (row) => row.notes || row.remarks || "—"],
      ]

      exportReportExcel({
        label: "Stock Transfers",
        filename: `Stock-Transfers-${new Date().toISOString().slice(0, 10)}`,
        columns: exportColumns,
        records: exportTransfers,
        branch: { name: user?.branch?.name || "All Branches" },
        generatedBy: user,
        filters: [
          ["Search Query", searchText.trim() || "All"],
          ["Status", statusFilter || "All statuses"],
          ["Direction", directionFilter === "OUT" ? "Outbound" : directionFilter === "IN" ? "Inbound" : "All Transfers"],
        ],
        totals: [
          ["Total Transfers Exported", exportTransfers.length],
        ],
      })
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Could not export stock transfers to Excel.")
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Supply / Stock</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Stock Transfers</h1>
            <p className="mt-0.5 text-xs text-slate-500">Requests remain auditable. Approval reserves no stock; fulfillment posts both branch movements atomically.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pageMode === "operations" ? (
              <ExportExcelButton
                filteredCount={pagination?.totalItems ?? transfers.length}
                label="Export Transfers (.xlsx)"
                onExport={handleExportTransfersExcel}
              />
            ) : null}
            <button className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition" onClick={loadTransfers} type="button">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        <div className="mt-5 flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setPageMode("operations")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              pageMode === "operations"
                ? "border-[var(--color-maroon)] text-[var(--color-maroon)] font-black"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <Truck size={14} />
            <span>Transfer Operations & Receiving</span>
          </button>
          <button
            type="button"
            onClick={() => setPageMode("reports")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              pageMode === "reports"
                ? "border-[var(--color-maroon)] text-[var(--color-maroon)] font-black"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <FileSpreadsheet size={14} />
            <span>Logistics Reports & Transfer Audit</span>
          </button>
        </div>
      </section>

      {errorMessage ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 flex items-center gap-2"><AlertCircle size={15} />{errorMessage}</div> : null}
      {successMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{successMessage}</div> : null}

      {pageMode === "reports" ? (
        <StockTransfersReportView
          branchId={effectiveBranchId}
          selectedBranch={selectedBranch}
          user={user}
          onRefresh={loadTransfers}
        />
      ) : (
        <>
          {/* Transfer In / Out Direction Tabs */}
          <div className="flex items-center border-b border-slate-200 gap-2 sm:gap-4 overflow-x-auto">
        <button
          className={`relative pb-2.5 pt-1 px-2 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            directionFilter === "ALL"
              ? "text-[var(--color-maroon)] border-b-2 border-[var(--color-maroon)]"
              : "text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => {
            setDirectionFilter("ALL")
            setPage(1)
          }}
          type="button"
        >
          <ArrowLeftRight size={13} />
          <span>All Transfers</span>
        </button>

        <button
          className={`relative pb-2.5 pt-1 px-2 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            directionFilter === "OUT"
              ? "text-amber-800 border-b-2 border-amber-700 font-black"
              : "text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => {
            setDirectionFilter("OUT")
            setPage(1)
          }}
          type="button"
        >
          <ArrowUpRight size={14} className={directionFilter === "OUT" ? "text-amber-700" : ""} />
          <span>Transfer Out</span>
        </button>

        <button
          className={`relative pb-2.5 pt-1 px-2 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            directionFilter === "IN"
              ? "text-sky-800 border-b-2 border-sky-700 font-black"
              : "text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => {
            setDirectionFilter("IN")
            setPage(1)
          }}
          type="button"
        >
          <ArrowDownLeft size={14} className={directionFilter === "IN" ? "text-sky-700" : ""} />
          <span>Transfer In</span>
        </button>

        <button
          className={`relative pb-2.5 pt-1 px-2 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            directionFilter === "BORROW"
              ? "text-purple-800 border-b-2 border-purple-700 font-black"
              : "text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => {
            setDirectionFilter("BORROW")
            setBorrowSubFilter("ALL")
            setPage(1)
          }}
          type="button"
        >
          <ArrowLeftRight size={14} className={directionFilter === "BORROW" ? "text-purple-700" : ""} />
          <span>Inter-Branch Borrow Monitoring</span>
        </button>
      </div>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:grid-cols-[1fr_200px]">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input className="w-full rounded-xl border border-slate-200 bg-white text-slate-800 py-2 pl-9 pr-3 text-xs outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setSearchText(event.target.value); setPage(1) }} placeholder="Search code or notes…" value={searchText} />
        </label>
        <select className="rounded-xl border border-slate-200 bg-white text-slate-800 px-3 py-2 text-xs outline-none focus:border-[var(--color-maroon)] font-semibold" onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} value={statusFilter}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="REQUESTED">Requested</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="POSTED">Posted</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </section>

      {directionFilter === "BORROW" ? (
        <section className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-purple-200 bg-purple-50/70 p-3 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-black text-purple-900 uppercase tracking-wide">Borrow Monitoring:</span>
            <span className="text-purple-800 text-[11px]">Track stock borrow turnover status — nasoli na o babayaran nalang.</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setBorrowSubFilter("ALL"); setPage(1) }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                borrowSubFilter === "ALL"
                  ? "bg-purple-700 text-white shadow-2xs"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              All Borrowed
            </button>
            <button
              type="button"
              onClick={() => { setBorrowSubFilter("ON_BORROW"); setPage(1) }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                borrowSubFilter === "ON_BORROW"
                  ? "bg-purple-800 text-white shadow-2xs"
                  : "bg-white text-purple-800 border border-purple-200 hover:bg-purple-50"
              }`}
            >
              🟣 On Borrow
            </button>
            <button
              type="button"
              onClick={() => { setBorrowSubFilter("RETURNED"); setPage(1) }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                borrowSubFilter === "RETURNED"
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50"
              }`}
            >
              🟢 Nasoli Na (Returned)
            </button>
            <button
              type="button"
              onClick={() => { setBorrowSubFilter("PURCHASED"); setPage(1) }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                borrowSubFilter === "PURCHASED"
                  ? "bg-blue-700 text-white shadow-2xs"
                  : "bg-white text-blue-800 border border-blue-200 hover:bg-blue-50"
              }`}
            >
              🔵 Babayaran Nalang (Purchased)
            </button>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1060px] text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Transfer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? <tr><td className="px-4 py-8 text-center font-bold text-slate-400" colSpan={7}>Loading stock transfers…</td></tr> : null}
              {!isLoading && transfers.length === 0 ? <tr><td className="px-4 py-8 text-center font-bold text-slate-400" colSpan={7}>No stock transfers found.</td></tr> : null}
              {!isLoading ? transfers.map((transfer) => {
                const isBorrow = isBorrowTransfer(transfer)
                const borrowStatus = getBorrowStatus(transfer)
                return (
                  <tr className="hover:bg-slate-50/50 transition" key={transfer.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-mono font-bold text-slate-900">{transfer.transferCode}</p>
                        <WorkflowBadge transfer={transfer} />
                        {isBorrow ? (
                          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                            borrowStatus === "RETURNED"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : borrowStatus === "PURCHASED"
                              ? "bg-blue-50 text-blue-800 border border-blue-200"
                              : "bg-purple-50 text-purple-800 border border-purple-200"
                          }`}>
                            {borrowStatus === "RETURNED"
                              ? "🟢 NASOLI NA"
                              : borrowStatus === "PURCHASED"
                              ? "🔵 BABAYARAN NALANG"
                              : "🟣 ON BORROW"}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 max-w-52 truncate text-[11px] text-slate-500">{transfer.notes || "No notes"}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={transfer.status} fulfillmentStatus={transfer.fulfillmentStatus} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                        <DirectionBadge transfer={transfer} activeBranchId={effectiveBranchId} />
                        <span className="font-semibold text-slate-800">
                          {transfer.fromBranch?.code || "—"} → {transfer.toBranch?.code || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{transfer.requestedBy?.fullName || transfer.requestedBy?.username || "—"}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">{transfer.items?.length || 0}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(transfer.requestedAt || transfer.transferDate)}</td>
                    <td className="px-4 py-3 text-right">
                      <ActionButtons
                        transfer={transfer}
                        user={user}
                        busy={actionTransferId === transfer.id}
                        onAction={handleAction}
                        onView={openTransfer}
                        onReceive={handleOpenReceive}
                        onPrintLoanSlip={handleOpenLoanSlip}
                        onReturnBorrow={handleOpenReturnBorrow}
                        onPurchaseBorrow={handleOpenPurchaseBorrow}
                      />
                    </td>
                  </tr>
                )
              }) : null}
            </tbody>
          </table>
        </div>

        <div className="grid gap-2.5 p-3 xl:hidden">
          {isLoading ? <p className="rounded-xl bg-slate-50 p-4 text-xs font-bold text-slate-400">Loading stock transfers…</p> : null}
          {!isLoading && transfers.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-xs font-bold text-slate-400">No stock transfers found.</p> : null}
          {!isLoading ? transfers.map((transfer) => {
            const isBorrow = isBorrowTransfer(transfer)
            const borrowStatus = getBorrowStatus(transfer)
            return (
              <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs text-xs" key={transfer.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-mono font-bold text-slate-900">{transfer.transferCode}</p>
                      <WorkflowBadge transfer={transfer} />
                      <DirectionBadge transfer={transfer} activeBranchId={effectiveBranchId} />
                      {isBorrow ? (
                        <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                          borrowStatus === "RETURNED"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : borrowStatus === "PURCHASED"
                            ? "bg-blue-50 text-blue-800 border border-blue-200"
                            : "bg-purple-50 text-purple-800 border border-purple-200"
                        }`}>
                          {borrowStatus === "RETURNED"
                            ? "🟢 NASOLI NA"
                            : borrowStatus === "PURCHASED"
                            ? "🔵 BABAYARAN NALANG"
                            : "🟣 ON BORROW"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{transfer.fromBranch?.code || "—"} → {transfer.toBranch?.code || "—"}</p>
                  </div>
                  <StatusBadge status={transfer.status} fulfillmentStatus={transfer.fulfillmentStatus} />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">{transfer.items?.length || 0} line(s) · {formatDate(transfer.requestedAt || transfer.transferDate)}</p>
                <div className="mt-3">
                  <ActionButtons
                    transfer={transfer}
                    user={user}
                    busy={actionTransferId === transfer.id}
                    onAction={handleAction}
                    onView={openTransfer}
                    onReceive={handleOpenReceive}
                    onPrintLoanSlip={handleOpenLoanSlip}
                    onReturnBorrow={handleOpenReturnBorrow}
                    onPurchaseBorrow={handleOpenPurchaseBorrow}
                  />
                </div>
              </article>
            )
          }) : null}
        </div>

        {pagination ? (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 p-3 text-xs text-slate-500">
            <p>Page {pagination.page} of {pagination.totalPages} · {pagination.totalItems} transfer(s)</p>
            <div className="flex gap-1.5">
              <button className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30" disabled={page <= 1 || isLoading} onClick={() => setPage((value) => Math.max(value - 1, 1))} type="button">Previous</button>
              <button className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30" disabled={page >= pagination.totalPages || isLoading} onClick={() => setPage((value) => value + 1)} type="button">Next</button>
            </div>
          </div>
        ) : null}
      </section>
        </>
      )}

      {selectedTransfer ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <section className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-maroon)]">{selectedTransfer.transferCode}</span>
                  <WorkflowBadge transfer={selectedTransfer} />
                  <StatusBadge status={selectedTransfer.status} fulfillmentStatus={selectedTransfer.fulfillmentStatus} />
                </div>
                <h2 className="mt-0.5 text-base font-black text-slate-900 leading-tight">Stock Transfer Details</h2>
              </div>
              <button className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" onClick={() => setSelectedTransfer(null)} type="button" aria-label="Close">
                <X size={16} />
              </button>
            </header>

            {isLoadingDetail ? (
              <div className="flex items-center justify-center gap-2 p-10 text-xs font-bold text-slate-500">Loading detail…</div>
            ) : (
              <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">From Branch</p><p className="mt-1 font-bold text-slate-900">{selectedTransfer.fromBranch?.code || "—"}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">To Branch</p><p className="mt-1 font-bold text-slate-900">{selectedTransfer.toBranch?.code || "—"}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Requested</p><p className="mt-1 font-semibold text-slate-700">{formatDate(selectedTransfer.requestedAt || selectedTransfer.transferDate)}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Posted</p><p className="mt-1 font-semibold text-slate-700">{formatDate(selectedTransfer.postedAt)}</p></div>
                  {selectedTransfer.dispatchedAt ? (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Dispatched</p>
                      <p className="mt-1 font-semibold text-slate-700">{formatDate(selectedTransfer.dispatchedAt)}</p>
                    </div>
                  ) : null}
                  {selectedTransfer.receivedAt ? (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Received</p>
                      <p className="mt-1 font-semibold text-slate-700">{formatDate(selectedTransfer.receivedAt)}</p>
                    </div>
                  ) : null}
                  {selectedTransfer.fulfillmentMethod ? (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Fulfillment</p><p className="mt-1 font-semibold text-slate-700">{selectedTransfer.fulfillmentMethod.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}{selectedTransfer.fulfillmentStatus ? ` (${selectedTransfer.fulfillmentStatus.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())})` : ""}</p></div>
                  ) : null}
                  {selectedTransfer.paymentStatus ? (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs"><p className="text-[10px] font-bold uppercase text-slate-500">Payment</p><p className="mt-1 font-semibold text-slate-700">{selectedTransfer.paymentStatus.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</p></div>
                  ) : null}
                </div>

                {isBorrowTransfer(selectedTransfer) ? (
                  <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-3.5 text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-purple-900 uppercase tracking-wide">Inter-Branch Stock Borrow</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                          getBorrowStatus(selectedTransfer) === "RETURNED"
                            ? "bg-emerald-100 text-emerald-800"
                            : getBorrowStatus(selectedTransfer) === "PURCHASED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}>
                          {getBorrowStatus(selectedTransfer) === "RETURNED"
                            ? "🟢 NASOLI NA (Returned to Source Branch)"
                            : getBorrowStatus(selectedTransfer) === "PURCHASED"
                            ? "🔵 BABAYARAN NALANG (Converted to Purchase)"
                            : "🟣 CURRENTLY ON BORROW"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenLoanSlip(selectedTransfer)}
                          className="inline-flex items-center gap-1 rounded-lg bg-purple-700 px-3 py-1 text-[11px] font-bold text-white hover:bg-purple-800 transition shadow-2xs"
                        >
                          <Printer size={13} /> Print Borrow Slip
                        </button>
                        {getBorrowStatus(selectedTransfer) === "ON_BORROW" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenReturnBorrow(selectedTransfer)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 transition shadow-2xs"
                            >
                              <RotateCcw size={13} /> Isoli (Return)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPurchaseBorrow(selectedTransfer)}
                              className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-1 text-[11px] font-bold text-blue-800 hover:bg-blue-50 transition shadow-2xs"
                            >
                              <CheckCircle2 size={13} /> Babayaran Nalang
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-[11px] text-purple-800">
                      This transfer is an inter-branch stock borrow. Zero monetary settlement is charged upon transfer. Track whether the items are physically returned (Nasoli na) or converted to purchase (Babayaran nalang).
                    </p>
                    {selectedTransfer.internalNotes && selectedTransfer.internalNotes.includes("[BORROW_STATUS:") ? (
                      <div className={`text-[11px] font-semibold rounded-lg p-2 ${
                        selectedTransfer.internalNotes.includes("[BORROW_STATUS:RETURNED]")
                          ? "text-emerald-800 bg-emerald-50 border border-emerald-200"
                          : selectedTransfer.internalNotes.includes("[BORROW_STATUS:PURCHASED]")
                          ? "text-blue-800 bg-blue-50 border border-blue-200"
                          : "text-purple-800 bg-purple-50 border border-purple-200"
                      }`}>
                        {selectedTransfer.internalNotes}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-3">
                  {selectedTransfer.items?.map((item) => (
                    <article className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs" key={item.id}>
                      <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                        <div>
                          <p className="font-bold text-slate-900">{item.item?.itemCode || "—"} · {item.item?.itemName || item.description || "Item"}</p>
                          <p className="text-[11px] text-slate-500">{item.description || item.item?.itemName || ""}</p>
                        </div>
                        <p className="font-mono font-bold text-slate-900">Qty {formatQuantity(item.quantity)}</p>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">Source batch: {item.fromBatch?.batchCode || "Automatic FIFO / serial allocation"}</p>

                      <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100"><p className="text-[10px] font-bold uppercase text-slate-400">Proposed / Unit</p><p className="mt-0.5 font-mono font-bold text-slate-800">{formatMoney(item.proposedTransferUnitPrice)}</p></div>
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100"><p className="text-[10px] font-bold uppercase text-slate-400">Agreed / Unit</p><p className="mt-0.5 font-mono font-bold text-slate-800">{formatMoney(item.agreedTransferUnitPrice)}</p></div>
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100"><p className="text-[10px] font-bold uppercase text-slate-400">Transfer Amount</p><p className="mt-0.5 font-mono font-black text-[var(--color-maroon)]">{formatMoney(item.transferAmount)}</p></div>
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100"><p className="text-[10px] font-bold uppercase text-slate-400">Dest. Item</p><p className="mt-0.5 font-bold text-slate-800 truncate">{item.destinationItem?.itemCode || "Locks on approval"}</p></div>
                      </div>

                      {canEditSelectedPricing ? (
                        <label className="mt-2.5 block">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">Agreed transfer price / unit</span>
                          <input
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                            min="0"
                            onChange={(event) =>
                              setPricingDrafts((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                            step="0.01"
                            type="number"
                            value={pricingDrafts[item.id] ?? ""}
                          />
                        </label>
                      ) : null}

                      {item.dispatchAllocations?.length ? (
                        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Dispatched Allocations (In Transit)</p>
                          {item.dispatchAllocations.map((alloc) => (
                            <div className="rounded-lg bg-amber-50/50 border border-amber-200/60 p-2 text-[11px]" key={alloc.id}>
                              <div className="grid gap-1.5 sm:grid-cols-2">
                                <p><span className="font-bold text-slate-600">Batch:</span> {alloc.sourceBatch?.batchCode}</p>
                                <p><span className="font-bold text-slate-600">Qty:</span> {formatQuantity(alloc.quantity)}</p>
                              </div>
                              {alloc.serials?.length ? (
                                <p className="mt-1 text-[10px] text-slate-600">
                                  Serials: {alloc.serials.map((serial) => serial.serialNumberSnapshot).join(", ")}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {item.allocations?.length ? (
                        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Posted Allocations</p>
                          {item.allocations.map((allocation) => (
                            <div className="rounded-lg bg-slate-50/75 border border-slate-100 p-2 text-[11px]" key={allocation.id}>
                              <div className="grid gap-1.5 sm:grid-cols-3">
                                <p><span className="font-bold text-slate-600">Route:</span> {allocation.sourceBatch?.batchCode} → {allocation.destinationBatch?.batchCode}</p>
                                <p><span className="font-bold text-slate-600">Qty:</span> {formatQuantity(allocation.quantity)}</p>
                                <p><span className="font-bold text-slate-600">Transfer Val:</span> {formatMoney(allocation.transferAmount)}</p>
                              </div>
                              {allocation.serials?.length ? <p className="mt-1 text-[10px] text-slate-500">Serials: {allocation.serials.map((serial) => serial.serialNumberSnapshot).join(", ")}</p> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {item.serials?.length ? <p className="mt-2 text-[11px] text-slate-500">Serials: {item.serials.map((serial) => serial.serialNumberSnapshot).join(", ")}</p> : null}
                    </article>
                  ))}
                </div>

                {canEditSelectedPricing ? (
                  <button className="rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50" disabled={actionTransferId === selectedTransfer.id} onClick={saveTransferPricing} type="button">
                    {actionTransferId === selectedTransfer.id ? "Saving pricing…" : "Save Agreed Pricing"}
                  </button>
                ) : null}

                <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3 text-xs">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Total Internal Transfer Value</p>
                  <p className="mt-0.5 font-mono font-black text-slate-900 text-sm">{formatMoney((selectedTransfer.items || []).reduce((sum, item) => sum + Number(item.transferAmount || 0), 0))}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Internal transfer accounting, not customer sales revenue.</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
                  <div className="text-[11px] text-slate-500">
                    <span>Requested by: <strong className="text-slate-700">{selectedTransfer.requestedBy?.fullName || selectedTransfer.requestedBy?.username || "—"}</strong></span>
                  </div>
                  <ActionButtons
                    transfer={selectedTransfer}
                    user={user}
                    busy={actionTransferId === selectedTransfer.id}
                    onAction={handleAction}
                    onView={() => {}}
                    onReceive={handleOpenReceive}
                    onPrintLoanSlip={handleOpenLoanSlip}
                    onReturnBorrow={handleOpenReturnBorrow}
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}

      <SerialScannerModal
        isOpen={isSerialModalOpen}
        items={serialModalItems}
        isSubmitting={isFulfillingSerials}
        onClose={() => {
          if (!isFulfillingSerials) {
            setIsSerialModalOpen(false)
            setSerialModalTransfer(null)
            setSerialModalItems([])
          }
        }}
        onConfirm={handleConfirmSerialFulfillment}
        subtitle={`Scan barcode or type serial numbers from ${serialModalTransfer?.fromBranch?.name || serialModalTransfer?.fromBranch?.code || "source branch"} to dispatch.`}
        title="Dispatch Stock Transfer"
        transferCode={serialModalTransfer?.transferCode || ""}
      />

      {isReceiveModalOpen && receiveModalTransfer ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">
                  Step 2 · Receive & Confirm
                </span>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Receive Stock Transfer: {receiveModalTransfer.transferCode}
                </h3>
              </div>
              <button
                aria-label="Close"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                disabled={isReceiving}
                onClick={() => {
                  setIsReceiveModalOpen(false)
                  setReceiveModalTransfer(null)
                }}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="rounded-xl border border-blue-100 bg-blue-50/75 p-3.5 text-slate-700 space-y-1">
                <p className="font-bold text-blue-900">
                  Verify Physical Stock & Serial Numbers
                </p>
                <p className="text-[11px] text-blue-800">
                  Check that the items and serial numbers delivered to your branch match the dispatched list below. Once confirmed, stock will be immediately admitted to your branch inventory.
                </p>
                <div className="pt-1 flex items-center gap-4 text-[11px] font-semibold text-slate-600">
                  <span>From: <strong className="text-slate-900">{receiveModalTransfer.fromBranch?.name || receiveModalTransfer.fromBranch?.code}</strong></span>
                  <span>To: <strong className="text-slate-900">{receiveModalTransfer.toBranch?.name || receiveModalTransfer.toBranch?.code}</strong></span>
                </div>
              </div>

              <div className="space-y-3">
                {(receiveModalTransfer.items || []).map((item) => {
                  const dispatchedSerials = (item.serials || []).map(
                    (s) => s.serialNumberSnapshot || s.itemSerial?.serialNumber
                  ).filter(Boolean)

                  return (
                    <article
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {item.item?.itemCode || "—"} · {item.item?.itemName || item.description || "Item"}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {[item.item?.brand, item.item?.modelName].filter(Boolean).join(" • ")}
                          </p>
                        </div>
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono font-bold text-slate-800">
                          Qty {formatQuantity(item.quantity)}
                        </span>
                      </div>

                      {dispatchedSerials.length > 0 ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1.5 flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            Dispatched Serial Numbers ({dispatchedSerials.length}):
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {dispatchedSerials.map((sn, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-900 shadow-2xs"
                              >
                                <CheckCircle2 size={11} className="text-emerald-500" />
                                {sn}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                disabled={isReceiving}
                onClick={() => {
                  setIsReceiveModalOpen(false)
                  setReceiveModalTransfer(null)
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition disabled:opacity-50"
                disabled={isReceiving}
                onClick={handleConfirmReceive}
                type="button"
              >
                <PackageCheck size={15} />
                {isReceiving ? "Confirming Receipt…" : "Confirm & Receive Stock"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
      {/* Official 2-Copy Inter-Branch Stock Loan Slip */}
      <StockLoanSlipModal
        isOpen={showLoanSlipModal}
        onClose={() => {
          setShowLoanSlipModal(false)
          setActiveLoanTransfer(null)
        }}
        transfer={activeLoanTransfer}
      />

      {/* Return Borrow Modal */}
      {/* Return Borrow Modal (Nasoli Na) */}
      {showReturnBorrowModal && returnBorrowTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-700">
                  Stock Borrow Turnover
                </span>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Return Borrowed Stock: {returnBorrowTarget.transferCode}
                </h3>
              </div>
              <button
                aria-label="Close"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                disabled={isSubmittingReturnBorrow}
                onClick={() => {
                  setShowReturnBorrowModal(false)
                  setReturnBorrowTarget(null)
                }}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={handleConfirmReturnBorrow}>
              <div className="p-5 space-y-4 text-xs">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-900 space-y-1">
                  <p className="font-bold text-xs">Return Items to Source Branch (Nasoli Na)</p>
                  <p className="text-[11px] text-emerald-800">
                    Confirm that the borrowed item(s) are being physically returned and turnover is acknowledged between branches.
                  </p>
                  <div className="pt-1 flex items-center gap-4 text-[11px] font-semibold text-slate-700">
                    <span>Source Branch: <strong className="text-slate-900">{returnBorrowTarget.fromBranch?.name || returnBorrowTarget.fromBranch?.code}</strong></span>
                    <span>Borrowing Branch: <strong className="text-slate-900">{returnBorrowTarget.toBranch?.name || returnBorrowTarget.toBranch?.code}</strong></span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Borrowed Items</p>
                  {(returnBorrowTarget.items || []).map((it) => (
                    <div key={it.id} className="flex justify-between items-center text-[11px] font-medium text-slate-800">
                      <span>{it.item?.itemName || it.description || "Item"}</span>
                      <span className="font-mono font-bold">Qty {it.quantity}</span>
                    </div>
                  ))}
                </div>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Physical Return Condition
                  </span>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isSubmittingReturnBorrow}
                    onChange={(e) => setReturnBorrowCondition(e.target.value)}
                    value={returnBorrowCondition}
                  >
                    <option value="Good Condition">Good Condition (Normal)</option>
                    <option value="Complete with Original Packaging">Complete with Original Packaging</option>
                    <option value="With Minor Wear">With Minor Wear</option>
                    <option value="Defective / Needs Inspection">Defective / Needs Inspection</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Return Remarks (Optional)
                  </span>
                  <textarea
                    className="mt-1 min-h-16 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isSubmittingReturnBorrow}
                    onChange={(e) => setReturnBorrowRemarks(e.target.value)}
                    placeholder="e.g. Returned after client demo or service borrow completion..."
                    value={returnBorrowRemarks}
                  />
                </label>
              </div>

              <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                  disabled={isSubmittingReturnBorrow}
                  onClick={() => {
                    setShowReturnBorrowModal(false)
                    setReturnBorrowTarget(null)
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 transition disabled:opacity-50"
                  disabled={isSubmittingReturnBorrow}
                  type="submit"
                >
                  {isSubmittingReturnBorrow ? "Processing..." : "Confirm Nasoli Na (Return)"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {/* Purchase Borrow Modal (Babayaran Nalang) */}
      {showPurchaseBorrowModal && purchaseBorrowTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-700">
                  Stock Borrow Settlement
                </span>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Babayaran Nalang: {purchaseBorrowTarget.transferCode}
                </h3>
              </div>
              <button
                aria-label="Close"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                disabled={isSubmittingPurchaseBorrow}
                onClick={() => {
                  setShowPurchaseBorrowModal(false)
                  setPurchaseBorrowTarget(null)
                }}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={handleConfirmPurchaseBorrow}>
              <div className="p-5 space-y-4 text-xs">
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-blue-900 space-y-1">
                  <p className="font-bold text-xs">Convert Borrow to Purchase / Payable</p>
                  <p className="text-[11px] text-blue-800">
                    Confirm that the borrowed item(s) will NOT be returned to the source branch. Destination branch will retain the stock, and it will be settled/paid between branches.
                  </p>
                  <div className="pt-1 flex items-center gap-4 text-[11px] font-semibold text-slate-700">
                    <span>Source (Creditor): <strong className="text-slate-900">{purchaseBorrowTarget.fromBranch?.name || purchaseBorrowTarget.fromBranch?.code}</strong></span>
                    <span>Destination (Buyer): <strong className="text-slate-900">{purchaseBorrowTarget.toBranch?.name || purchaseBorrowTarget.toBranch?.code}</strong></span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Items Retained</p>
                  {(purchaseBorrowTarget.items || []).map((it) => (
                    <div key={it.id} className="flex justify-between items-center text-[11px] font-medium text-slate-800">
                      <span>{it.item?.itemName || it.description || "Item"}</span>
                      <span className="font-mono font-bold">Qty {it.quantity}</span>
                    </div>
                  ))}
                </div>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Reason / Purchase Remarks (Optional)
                  </span>
                  <textarea
                    className="mt-1 min-h-16 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isSubmittingPurchaseBorrow}
                    onChange={(e) => setPurchaseBorrowRemarks(e.target.value)}
                    placeholder="e.g. Sold directly to customer, or destination branch decided to permanently retain stock..."
                    value={purchaseBorrowRemarks}
                  />
                </label>
              </div>

              <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                  disabled={isSubmittingPurchaseBorrow}
                  onClick={() => {
                    setShowPurchaseBorrowModal(false)
                    setPurchaseBorrowTarget(null)
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-blue-800 transition disabled:opacity-50"
                  disabled={isSubmittingPurchaseBorrow}
                  type="submit"
                >
                  {isSubmittingPurchaseBorrow ? "Processing..." : "Confirm Babayaran Nalang"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

