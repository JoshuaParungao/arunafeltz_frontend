import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  FileSpreadsheet,
  PackageCheck,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
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

function StatusBadge({ transfer, status: statusProp, fulfillmentStatus: fulfillmentStatusProp }) {
  const status = statusProp || transfer?.status
  const fulfillmentStatus = fulfillmentStatusProp || transfer?.fulfillmentStatus
  const fulfillmentMethod = transfer?.fulfillmentMethod
  const fulfillmentReference = transfer?.fulfillmentReference

  // Active Dispatch / In-Progress States
  if ((fulfillmentStatus === "IN_TRANSIT" || fulfillmentStatus === "READY_FOR_PICKUP") && status !== "CANCELLED" && status !== "POSTED") {
    if (fulfillmentMethod === "PICKUP" || fulfillmentStatus === "READY_FOR_PICKUP") {
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-300 px-2.5 py-0.5 text-xs font-black text-amber-800 shadow-2xs"
          title={fulfillmentReference ? `Ready for pick up by: ${fulfillmentReference}` : "Ready for pick up"}
        >
          <PackageCheck size={12} className="text-amber-600" /> Transfer Out (Ready for Pick up)
        </span>
      )
    }
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-300 px-2.5 py-0.5 text-xs font-black text-sky-800 shadow-2xs"
        title={fulfillmentReference ? `Out for delivery via: ${fulfillmentReference}` : "Out for delivery"}
      >
        <Truck size={12} className="text-sky-600" /> Transfer Out (Out for Delivery)
      </span>
    )
  }

  if (status === "APPROVED" && fulfillmentStatus !== "IN_TRANSIT" && fulfillmentStatus !== "READY_FOR_PICKUP") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-black text-blue-800 shadow-2xs">
        <Clock size={12} className="text-blue-600" /> For Transfer Out
      </span>
    )
  }

  if (status === "POSTED" || fulfillmentStatus === "RECEIVED") {
    if (fulfillmentMethod === "PICKUP") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 text-xs font-black text-emerald-800 shadow-2xs">
          <CheckCircle2 size={12} className="text-emerald-600" /> Transferred In (Claimed)
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 text-xs font-black text-emerald-800 shadow-2xs">
        <CheckCircle2 size={12} className="text-emerald-600" /> Transferred In (Received)
      </span>
    )
  }

  const styles = {
    REQUESTED: "bg-amber-50 text-amber-700 border border-amber-200",
    APPROVED: "bg-blue-50 text-blue-700 border border-blue-200",
    REJECTED: "bg-rose-50 text-rose-700 border border-rose-200",
    POSTED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    CANCELLED: "bg-gray-100 text-gray-600 border border-gray-200",
    DRAFT: "bg-slate-100 text-slate-700 border border-slate-200",
  }

  const formatted = String(status || "Unknown")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ${styles[status] || styles.DRAFT}`}>{formatted}</span>
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

function getBorrowDetails(transfer) {
  const combined = `${transfer?.notes || ""} ${transfer?.internalNotes || ""}`
  if (!combined.includes("[TRANSFER_TYPE:BORROW]")) return null

  let status = "ON_BORROW"
  if (combined.includes("[BORROW_STATUS:RETURNED]")) status = "RETURNED"
  else if (combined.includes("[BORROW_STATUS:PURCHASED]") || combined.includes("[BORROW_STATUS:CONVERTED_TO_PURCHASE]")) status = "PURCHASED"
  else if (combined.includes("[BORROW_STATUS:RETURN_IN_TRANSIT]")) status = "RETURN_IN_TRANSIT"
  else if (combined.includes("[BORROW_STATUS:PAYMENT_SUBMITTED]")) status = "PAYMENT_SUBMITTED"
  else if (combined.includes("[BORROW_STATUS:WAITING_PAYMENT]")) status = "WAITING_PAYMENT"
  else if (combined.includes("[BORROW_STATUS:WAITING_AMOUNT]")) status = "WAITING_AMOUNT"

  const billingAmountMatch = combined.match(/\[BILLING_AMOUNT:([\d.]+)\]/)
  const billingAmount = billingAmountMatch ? billingAmountMatch[1] : null

  const paymentInstructionsMatch = combined.match(/\[PAYMENT_INSTRUCTIONS:([^\]]+)\]/)
  const paymentInstructions = paymentInstructionsMatch ? paymentInstructionsMatch[1] : null

  const paidAmountMatch = combined.match(/\[PAID_AMOUNT:([\d.]+)\]/)
  const paidAmount = paidAmountMatch ? paidAmountMatch[1] : null

  const paidMethodMatch = combined.match(/\[PAID_METHOD:([^\]]+)\]/)
  const paidMethod = paidMethodMatch ? paidMethodMatch[1] : null

  const paidRefMatch = combined.match(/\[PAID_REF:([^\]]+)\]/)
  const paidRef = paidRefMatch ? paidRefMatch[1] : null

  const returnMethodMatch = combined.match(/\[RETURN_METHOD:([^\]]+)\]/)
  const returnMethod = returnMethodMatch ? returnMethodMatch[1] : null

  const returnCourierMatch = combined.match(/\[RETURN_COURIER:([^\]]+)\]/)
  const returnCourier = returnCourierMatch ? returnCourierMatch[1] : null

  const returnSerialsMatch = combined.match(/\[RETURN_SERIALS:([^\]]+)\]/)
  const returnSerials = returnSerialsMatch ? returnSerialsMatch[1] : null

  const returnConditionMatch = combined.match(/\[RETURN_CONDITION:([^\]]+)\]/)
  const returnCondition = returnConditionMatch ? returnConditionMatch[1] : null

  return {
    status,
    billingAmount,
    paymentInstructions,
    paidAmount,
    paidMethod,
    paidRef,
    returnMethod,
    returnCourier,
    returnSerials,
    returnCondition,
  }
}

function getBorrowStatus(transfer) {
  const details = getBorrowDetails(transfer)
  return details ? details.status : null
}

function BorrowBadge({ transfer }) {
  const isBorrow = isBorrowTransfer(transfer)
  if (!isBorrow) return null
  const bDetails = getBorrowDetails(transfer)
  const bStatus = bDetails?.status

  if (bStatus === "RETURNED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300">
        <CheckCircle2 size={11} /> 🟢 NASOLI NA
      </span>
    )
  }
  if (bStatus === "PURCHASED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-300">
        <CheckCircle2 size={11} /> 🔵 BABAYARAN NALANG
      </span>
    )
  }
  if (bStatus === "RETURN_IN_TRANSIT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300">
        <Truck size={11} /> 🚚 Returning (In Transit)
      </span>
    )
  }
  if (bStatus === "WAITING_AMOUNT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black bg-yellow-50 text-yellow-800 border border-yellow-300">
        <Clock size={11} /> 🟡 Awaiting Billing Amount
      </span>
    )
  }
  if (bStatus === "WAITING_PAYMENT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black bg-orange-50 text-orange-800 border border-orange-300">
        <Clock size={11} /> 🟠 Waiting for Payment{bDetails.billingAmount ? ` (₱${Number(bDetails.billingAmount).toLocaleString()})` : ""}
      </span>
    )
  }
  if (bStatus === "PAYMENT_SUBMITTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black bg-indigo-50 text-indigo-800 border border-indigo-300">
        <Clock size={11} /> 🟣 Payment Submitted
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black bg-purple-50 text-purple-800 border border-purple-200">
      🟣 ON BORROW
    </span>
  )
}

function ActionButtons({
  transfer,
  user,
  busy,
  onAction,
  onView,
  onReceive,
  onPrintLoanSlip,
  onInitiateReturn,
  onConfirmReturn,
  onInitiatePurchase,
  onSetBilling,
  onPayBorrow,
  onConfirmPayment,
}) {
  const isSuperOwner = user?.role === "SUPER_OWNER"
  const isSourceManager = isSuperOwner || transfer.fromBranchId === user?.branchId
  const isDestinationManager = isSuperOwner || transfer.toBranchId === user?.branchId
  const isLinkedManager = isSourceManager || isDestinationManager
  const isReadyForPickup = transfer.fulfillmentStatus === "READY_FOR_PICKUP"
  const isInTransit = transfer.fulfillmentStatus === "IN_TRANSIT" || isReadyForPickup
  const isTerminal = ["POSTED", "REJECTED", "CANCELLED"].includes(transfer.status)
  const isTransferredIn = ["POSTED"].includes(transfer.status) || transfer.fulfillmentStatus === "RECEIVED" || Boolean(transfer.receivedAt)
  const isBorrow = isBorrowTransfer(transfer)
  const borrowDetails = getBorrowDetails(transfer)
  const borrowStatus = borrowDetails?.status
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

      {/* --- BORROW SETTLEMENT ACTIONS: ONLY AVAILABLE AFTER BEING TRANSFERRED IN! --- */}
      {isBorrow && isTransferredIn ? (
        <>
          {/* Step 1: Active on borrow -> Borrower can return replacement OR choose to buy */}
          {borrowStatus === "ON_BORROW" && isDestinationManager ? (
            <>
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                disabled={busy}
                onClick={() => onInitiateReturn(transfer)}
                type="button"
                title="Isoli sa source branch (Palitan ng bago)"
              >
                <RotateCcw size={13} /> Isoli (Palitan ng Bago)
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800 hover:bg-blue-100 transition shadow-2xs"
                disabled={busy}
                onClick={() => onInitiatePurchase(transfer)}
                type="button"
                title="Babayaran nalang ng destination branch"
              >
                <CheckCircle2 size={13} /> Babayaran Nalang
              </button>
            </>
          ) : null}

          {/* Return Flow: Return is in-transit -> Lending branch confirms receipt */}
          {borrowStatus === "RETURN_IN_TRANSIT" && isSourceManager ? (
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-800 transition"
              disabled={busy}
              onClick={() => onConfirmReturn(transfer)}
              type="button"
              title="Kumpirmahin na natanggap ang isinoli o ipinalit na stock"
            >
              <PackageCheck size={13} /> Receive Return (Nasoli Na)
            </button>
          ) : null}

          {/* Payment Flow Step A: Awaiting billing amount -> Lending branch sends amount */}
          {borrowStatus === "WAITING_AMOUNT" && isSourceManager ? (
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-blue-800 transition"
              disabled={busy}
              onClick={() => onSetBilling(transfer)}
              type="button"
              title="I-set ang amount na babayaran para sa stock"
            >
              <Send size={13} /> Send Amount (Billing)
            </button>
          ) : null}

          {/* Payment Flow Step B: Awaiting payment -> Borrower branch pays */}
          {borrowStatus === "WAITING_PAYMENT" && isDestinationManager ? (
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-amber-700 transition"
              disabled={busy}
              onClick={() => onPayBorrow(transfer)}
              type="button"
              title="Magbayad sa lending branch"
            >
              <CreditCard size={13} /> Magbayad (Pay)
            </button>
          ) : null}

          {/* Payment Flow Step C: Payment submitted -> Lending branch confirms payment received */}
          {borrowStatus === "PAYMENT_SUBMITTED" && isSourceManager ? (
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-800 transition"
              disabled={busy}
              onClick={() => onConfirmPayment(transfer)}
              type="button"
              title="Kumpirmahin na natanggap ang bayad mula sa destination branch"
            >
              <CheckCircle2 size={13} /> Confirm Payment Received
            </button>
          ) : null}
        </>
      ) : null}

      {/* --- STANDARD TRANSFER LIFECYCLE (Approve -> Transfer Out Dispatch -> Receive) --- */}
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
        <button className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-amber-700 transition" disabled={busy} onClick={() => onAction(transfer, "DISPATCH")} type="button" title="Piliin ang serial numbers at fulfillment details para ma-transfer out">
          Transfer Out (Dispatch)
        </button>
      ) : null}
      {isLinkedManager && isInTransit ? (
        transfer.fulfillmentMethod === "PICKUP" || isReadyForPickup ? (
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-amber-700 transition"
            disabled={busy}
            onClick={() => onReceive(transfer)}
            type="button"
            title={
              isSourceManager
                ? "Kumpirmahin na na-claim at na-release na ang stock sa kabilang branch"
                : "Kumpirmahin na na-claim o nakuha na ang stock mula sa source branch"
            }
          >
            <PackageCheck size={13} /> {isSourceManager ? "Confirm Claimed / Released" : "Confirm Claimed (Na-claim Na)"}
          </button>
        ) : (
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
            disabled={busy}
            onClick={() => onReceive(transfer)}
            type="button"
            title={
              isSourceManager
                ? "Kumpirmahin na naihatid / natanggap na sa destination branch ang delivery"
                : "Kumpirmahin na natanggap na ang delivery sa inyong branch"
            }
          >
            <PackageCheck size={13} /> {isSourceManager ? "Confirm Delivered (Naihatid Na)" : "Confirm Received (Natanggap Na)"}
          </button>
        )
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

  // 6-Step Borrow Lifecycle States
  // Transfer Out (Dispatch: Delivery vs Pick up & Serials) States
  const [showTransferOutModal, setShowTransferOutModal] = useState(false)
  const [transferOutTarget, setTransferOutTarget] = useState(null)
  const [transferOutMethod, setTransferOutMethod] = useState("DELIVERY") // "DELIVERY" | "PICKUP"
  const [transferOutCourier, setTransferOutCourier] = useState("")
  const [transferOutTrackingNo, setTransferOutTrackingNo] = useState("")
  const [transferOutPickupPerson, setTransferOutPickupPerson] = useState("")
  const [transferOutPickupContact, setTransferOutPickupContact] = useState("")
  const [transferOutRemarks, setTransferOutRemarks] = useState("")
  const [transferOutItems, setTransferOutItems] = useState([]) // [{ stockTransferItemId, itemId, itemName, itemCode, requiredQuantity, availableSerials }]
  const [transferOutSelectedSerials, setTransferOutSelectedSerials] = useState({}) // { [stockTransferItemId]: string[] (ids) }
  const [isSubmittingTransferOut, setIsSubmittingTransferOut] = useState(false)

  const [showInitiateReturnModal, setShowInitiateReturnModal] = useState(false)
  const [initiateReturnTarget, setInitiateReturnTarget] = useState(null)
  const [initiateReturnCondition, setInitiateReturnCondition] = useState("Brand New Replacement")
  const [initiateReturnMethod, setInitiateReturnMethod] = useState("DELIVERY")
  const [initiateReturnCourier, setInitiateReturnCourier] = useState("")
  const [initiateReturnTrackingNo, setInitiateReturnTrackingNo] = useState("")
  const [initiateReturnSerials, setInitiateReturnSerials] = useState("")
  const [initiateReturnRemarks, setInitiateReturnRemarks] = useState("")
  const [isSubmittingInitiateReturn, setIsSubmittingInitiateReturn] = useState(false)

  const [showConfirmReturnModal, setShowConfirmReturnModal] = useState(false)
  const [confirmReturnTarget, setConfirmReturnTarget] = useState(null)
  const [confirmReturnRemarks, setConfirmReturnRemarks] = useState("")
  const [isSubmittingConfirmReturn, setIsSubmittingConfirmReturn] = useState(false)

  const [showInitiatePurchaseModal, setShowInitiatePurchaseModal] = useState(false)
  const [initiatePurchaseTarget, setInitiatePurchaseTarget] = useState(null)
  const [initiatePurchaseRemarks, setInitiatePurchaseRemarks] = useState("")
  const [isSubmittingInitiatePurchase, setIsSubmittingInitiatePurchase] = useState(false)

  const [showSetBillingModal, setShowSetBillingModal] = useState(false)
  const [setBillingTarget, setSetBillingTarget] = useState(null)
  const [billingAmountInput, setBillingAmountInput] = useState("")
  const [billingInstructionsInput, setBillingInstructionsInput] = useState("")
  const [billingRemarksInput, setBillingRemarksInput] = useState("")
  const [isSubmittingSetBilling, setIsSubmittingSetBilling] = useState(false)

  const [showPayBorrowModal, setShowPayBorrowModal] = useState(false)
  const [payBorrowTarget, setPayBorrowTarget] = useState(null)
  const [payAmountInput, setPayAmountInput] = useState("")
  const [payMethodInput, setPayMethodInput] = useState("CASH")
  const [payRefInput, setPayRefInput] = useState("")
  const [payRemarksInput, setPayRemarksInput] = useState("")
  const [isSubmittingPayBorrow, setIsSubmittingPayBorrow] = useState(false)

  const [showConfirmPaymentModal, setShowConfirmPaymentModal] = useState(false)
  const [confirmPaymentTarget, setConfirmPaymentTarget] = useState(null)
  const [confirmPaymentRemarks, setConfirmPaymentRemarks] = useState("")
  const [isSubmittingConfirmPayment, setIsSubmittingConfirmPayment] = useState(false)

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
          if (borrowSubFilter === "ON_BORROW") return ["ON_BORROW", "RETURN_IN_TRANSIT", "WAITING_AMOUNT", "WAITING_PAYMENT", "PAYMENT_SUBMITTED"].includes(bStatus)
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

  const handleOpenInitiateReturn = (transfer) => {
    setInitiateReturnTarget(transfer)
    setInitiateReturnCondition("Brand New Replacement")
    setInitiateReturnMethod("DELIVERY")
    setInitiateReturnCourier("")
    setInitiateReturnTrackingNo("")
    setInitiateReturnSerials("")
    setInitiateReturnRemarks("")
    setShowInitiateReturnModal(true)
  }

  const handleConfirmInitiateReturn = async (event) => {
    if (event) event.preventDefault()
    if (!initiateReturnTarget) return

    setIsSubmittingInitiateReturn(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await returnBorrowTransfer(initiateReturnTarget.id, {
        actionType: "INITIATE_RETURN",
        condition: initiateReturnCondition,
        fulfillmentMethod: initiateReturnMethod,
        courier: initiateReturnCourier,
        trackingNo: initiateReturnTrackingNo,
        replacementSerials: initiateReturnSerials,
        remarks: initiateReturnRemarks,
      })
      setSuccessMessage(
        `Replacement stock return for ${initiateReturnTarget.transferCode} dispatched. Stock is now Returning In Transit.`
      )
      setShowInitiateReturnModal(false)
      setInitiateReturnTarget(null)
      if (selectedTransfer?.id === initiateReturnTarget.id) {
        setSelectedTransfer(response?.data || null)
      }
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not dispatch replacement return."
      )
    } finally {
      setIsSubmittingInitiateReturn(false)
    }
  }

  const handleOpenConfirmReturn = (transfer) => {
    setConfirmReturnTarget(transfer)
    setConfirmReturnRemarks("")
    setShowConfirmReturnModal(true)
  }

  const handleConfirmConfirmReturn = async (event) => {
    if (event) event.preventDefault()
    if (!confirmReturnTarget) return

    setIsSubmittingConfirmReturn(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await returnBorrowTransfer(confirmReturnTarget.id, {
        actionType: "CONFIRM_RETURN",
        remarks: confirmReturnRemarks,
      })
      setSuccessMessage(
        `Stock borrow ${confirmReturnTarget.transferCode} confirmed returned. Marked as NASOLI NA (Completed).`
      )
      setShowConfirmReturnModal(false)
      setConfirmReturnTarget(null)
      if (selectedTransfer?.id === confirmReturnTarget.id) {
        setSelectedTransfer(response?.data || null)
      }
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not confirm returned stock receipt."
      )
    } finally {
      setIsSubmittingConfirmReturn(false)
    }
  }

  const handleOpenInitiatePurchase = (transfer) => {
    setInitiatePurchaseTarget(transfer)
    setInitiatePurchaseRemarks("")
    setShowInitiatePurchaseModal(true)
  }

  const handleConfirmInitiatePurchase = async (event) => {
    if (event) event.preventDefault()
    if (!initiatePurchaseTarget) return

    setIsSubmittingInitiatePurchase(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await returnBorrowTransfer(initiatePurchaseTarget.id, {
        actionType: "INITIATE_PURCHASE",
        remarks: initiatePurchaseRemarks,
      })
      setSuccessMessage(
        `Purchase conversion requested for ${initiatePurchaseTarget.transferCode}. Awaiting billing amount from source branch.`
      )
      setShowInitiatePurchaseModal(false)
      setInitiatePurchaseTarget(null)
      if (selectedTransfer?.id === initiatePurchaseTarget.id) {
        setSelectedTransfer(response?.data || null)
      }
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not request purchase conversion."
      )
    } finally {
      setIsSubmittingInitiatePurchase(false)
    }
  }

  const handleOpenSetBilling = (transfer) => {
    setSetBillingTarget(transfer)
    const bDetails = getBorrowDetails(transfer)
    let suggested = 0
    if (Array.isArray(transfer.items)) {
      suggested = transfer.items.reduce((sum, it) => {
        const p = Number(it.agreedTransferUnitPrice ?? it.proposedTransferUnitPrice ?? it.destinationItem?.price1 ?? 0)
        return sum + p * Number(it.quantity || 1)
      }, 0)
    }
    setBillingAmountInput(bDetails?.billingAmount || (suggested > 0 ? suggested.toString() : ""))
    setBillingInstructionsInput(bDetails?.paymentInstructions || "GCash / Cash turnover at branch")
    setBillingRemarksInput("")
    setShowSetBillingModal(true)
  }

  const handleConfirmSetBilling = async (event) => {
    if (event) event.preventDefault()
    if (!setBillingTarget) return

    if (!billingAmountInput || Number(billingAmountInput) <= 0) {
      setErrorMessage("Please enter a valid billing amount greater than 0.")
      return
    }

    setIsSubmittingSetBilling(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await returnBorrowTransfer(setBillingTarget.id, {
        actionType: "SET_BILLING_AMOUNT",
        amount: Number(billingAmountInput),
        paymentInstructions: billingInstructionsInput,
        remarks: billingRemarksInput,
      })
      setSuccessMessage(
        `Billing of ₱${Number(billingAmountInput).toLocaleString()} sent to borrowing branch for ${setBillingTarget.transferCode}.`
      )
      setShowSetBillingModal(false)
      setSetBillingTarget(null)
      if (selectedTransfer?.id === setBillingTarget.id) {
        setSelectedTransfer(response?.data || null)
      }
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not send billing amount."
      )
    } finally {
      setIsSubmittingSetBilling(false)
    }
  }

  const handleOpenPayBorrow = (transfer) => {
    setPayBorrowTarget(transfer)
    const bDetails = getBorrowDetails(transfer)
    setPayAmountInput(bDetails?.billingAmount || "")
    setPayMethodInput(bDetails?.paidMethod || "CASH")
    setPayRefInput(bDetails?.paidRef || "")
    setPayRemarksInput("")
    setShowPayBorrowModal(true)
  }

  const handleConfirmPayBorrow = async (event) => {
    if (event) event.preventDefault()
    if (!payBorrowTarget) return

    if (!payAmountInput || Number(payAmountInput) <= 0) {
      setErrorMessage("Please enter a valid payment amount.")
      return
    }

    setIsSubmittingPayBorrow(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await returnBorrowTransfer(payBorrowTarget.id, {
        actionType: "SUBMIT_PAYMENT",
        amount: Number(payAmountInput),
        paymentMethod: payMethodInput,
        referenceNo: payRefInput,
        remarks: payRemarksInput,
      })
      setSuccessMessage(
        `Payment of ₱${Number(payAmountInput).toLocaleString()} via ${payMethodInput} submitted for ${payBorrowTarget.transferCode}. Awaiting source branch confirmation.`
      )
      setShowPayBorrowModal(false)
      setPayBorrowTarget(null)
      if (selectedTransfer?.id === payBorrowTarget.id) {
        setSelectedTransfer(response?.data || null)
      }
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not submit payment."
      )
    } finally {
      setIsSubmittingPayBorrow(false)
    }
  }

  const handleOpenConfirmPayment = (transfer) => {
    setConfirmPaymentTarget(transfer)
    setConfirmPaymentRemarks("")
    setShowConfirmPaymentModal(true)
  }

  const handleConfirmConfirmPayment = async (event) => {
    if (event) event.preventDefault()
    if (!confirmPaymentTarget) return

    setIsSubmittingConfirmPayment(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const bDetails = getBorrowDetails(confirmPaymentTarget)
      const response = await returnBorrowTransfer(confirmPaymentTarget.id, {
        actionType: "CONFIRM_PAYMENT",
        amount: bDetails?.paidAmount || bDetails?.billingAmount || "",
        paymentMethod: bDetails?.paidMethod || "CASH",
        referenceNo: bDetails?.paidRef || "",
        remarks: confirmPaymentRemarks,
      })
      setSuccessMessage(
        `Payment confirmed for ${confirmPaymentTarget.transferCode}. Marked as BABAYARAN NALANG (Paid & Completed).`
      )
      setShowConfirmPaymentModal(false)
      setConfirmPaymentTarget(null)
      if (selectedTransfer?.id === confirmPaymentTarget.id) {
        setSelectedTransfer(response?.data || null)
      }
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not confirm payment receipt."
      )
    } finally {
      setIsSubmittingConfirmPayment(false)
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
      const updatedTransfer = response?.data || transfer
      setSuccessMessage(`${updatedTransfer.transferCode || transfer.transferCode} is ${nextStatus.toLowerCase()}.`)
      if (selectedTransfer?.id === transfer.id) setSelectedTransfer(updatedTransfer)
      await loadTransfers()

      // When APPROVED: immediately open the fill-up / dispatch modal for the approver!
      if (nextStatus === "APPROVED") {
        await handleAction(updatedTransfer, "DISPATCH")
      }
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
      const isPickupClaim = receiveModalTransfer.fulfillmentMethod === "PICKUP" || receiveModalTransfer.fulfillmentStatus === "READY_FOR_PICKUP";
      const isSourceUser = user?.branchId === receiveModalTransfer.fromBranchId;
      setSuccessMessage(
        isPickupClaim
          ? (isSourceUser
              ? `${response?.data?.transferCode || receiveModalTransfer.transferCode} successfully confirmed claimed/released. Stock transferred to destination branch.`
              : `${response?.data?.transferCode || receiveModalTransfer.transferCode} successfully claimed for branch pickup. Stock has been added to your branch inventory.`)
          : (isSourceUser
              ? `${response?.data?.transferCode || receiveModalTransfer.transferCode} successfully confirmed delivered. Stock transferred to destination branch.`
              : `${response?.data?.transferCode || receiveModalTransfer.transferCode} successfully received from delivery. Stock has been added to your branch inventory.`)
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

  const handleOpenTransferOut = async (transfer) => {
    setActionTransferId(transfer.id)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await getStockTransferById(transfer.id)
      const detail = response?.data || transfer
      const serializedLines = (detail.items || []).filter(
        (item) => item.item?.isSerialized || item.isSerialized
      )

      let itemsWithSerials = []
      if (serializedLines.length > 0) {
        const fromBranchId = detail.fromBranchId || detail.fromBranch?.id || transfer.fromBranchId || transfer.fromBranch?.id
        itemsWithSerials = await Promise.all(
          serializedLines.map(async (line) => {
            const itemId = line.itemId || line.item?.id
            const serialRes = await getInventorySerials({
              branchId: fromBranchId,
              itemId,
              status: "AVAILABLE",
              limit: 100,
            })
            let serialRows = extractSerialRows(serialRes)

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
      }

      setTransferOutTarget(detail)
      setTransferOutItems(itemsWithSerials)
      const initialSelected = {}
      itemsWithSerials.forEach((it) => {
        initialSelected[it.stockTransferItemId] = (it.availableSerials || [])
          .slice(0, it.requiredQuantity)
          .map((s) => s.id)
      })
      setTransferOutSelectedSerials(initialSelected)
      setTransferOutMethod(detail.fulfillmentMethod || "DELIVERY")
      setTransferOutCourier("")
      setTransferOutTrackingNo("")
      setTransferOutPickupPerson("")
      setTransferOutPickupContact("")
      setTransferOutRemarks(detail.notes || "")
      setShowTransferOutModal(true)
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not open transfer out process."
      )
    } finally {
      setActionTransferId("")
    }
  }

  const handleConfirmTransferOut = async (event) => {
    if (event) event.preventDefault()
    if (!transferOutTarget) return

    for (const it of transferOutItems) {
      const selected = transferOutSelectedSerials[it.stockTransferItemId] || []
      if (selected.length !== it.requiredQuantity) {
        setErrorMessage(
          `Item "${it.itemName}" requires ${it.requiredQuantity} serial(s). You selected ${selected.length}.`
        )
        return
      }
    }

    setIsSubmittingTransferOut(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const refParts =
        transferOutMethod === "DELIVERY"
          ? [transferOutCourier.trim(), transferOutTrackingNo.trim()].filter(Boolean)
          : [transferOutPickupPerson.trim(), transferOutPickupContact.trim()].filter(Boolean)
      const fulfillmentReference = refParts.join(" - ")

      const itemsPayload = Object.entries(transferOutSelectedSerials).map(
        ([stockTransferItemId, serialIds]) => ({
          stockTransferItemId,
          serialIds,
          newSerialNumbers: [],
        })
      )

      const payload = {
        fulfillmentMethod: transferOutMethod,
        ...(fulfillmentReference ? { fulfillmentReference } : {}),
        ...(transferOutRemarks.trim() ? { notes: transferOutRemarks.trim() } : {}),
        ...(itemsPayload.length > 0 ? { items: itemsPayload } : {}),
      }

      const response = await dispatchStockTransfer(transferOutTarget.id, payload)
      const updated = response?.data || transferOutTarget
      setSuccessMessage(
        transferOutMethod === "DELIVERY"
          ? `${updated.transferCode} transferred out via Delivery (${transferOutCourier || "Courier"}). Marked as Out for Delivery / In Transit.`
          : `${updated.transferCode} transferred out for Branch Pick up (${transferOutPickupPerson || "Authorized Staff"}). Marked as Pick up in Progress / In Transit.`
      )
      setShowTransferOutModal(false)
      setTransferOutTarget(null)
      if (selectedTransfer?.id === transferOutTarget.id) setSelectedTransfer(updated)
      await loadTransfers()
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Could not process transfer out."
      )
    } finally {
      setIsSubmittingTransferOut(false)
    }
  }

  const handleAction = async (transfer, nextStatus) => {
    if (nextStatus === "DISPATCH" || nextStatus === "POSTED") {
      await handleOpenTransferOut(transfer)
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
                        <BorrowBadge transfer={transfer} />
                      </div>
                      <p className="mt-0.5 max-w-52 truncate text-[11px] text-slate-500">{transfer.notes || "No notes"}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge transfer={transfer} status={transfer.status} fulfillmentStatus={transfer.fulfillmentStatus} /></td>
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
                        onInitiateReturn={handleOpenInitiateReturn}
                        onConfirmReturn={handleOpenConfirmReturn}
                        onInitiatePurchase={handleOpenInitiatePurchase}
                        onSetBilling={handleOpenSetBilling}
                        onPayBorrow={handleOpenPayBorrow}
                        onConfirmPayment={handleOpenConfirmPayment}
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
                      <BorrowBadge transfer={transfer} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{transfer.fromBranch?.code || "—"} → {transfer.toBranch?.code || "—"}</p>
                  </div>
                  <StatusBadge transfer={transfer} status={transfer.status} fulfillmentStatus={transfer.fulfillmentStatus} />
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
                    onInitiateReturn={handleOpenInitiateReturn}
                    onConfirmReturn={handleOpenConfirmReturn}
                    onInitiatePurchase={handleOpenInitiatePurchase}
                    onSetBilling={handleOpenSetBilling}
                    onPayBorrow={handleOpenPayBorrow}
                    onConfirmPayment={handleOpenConfirmPayment}
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
                  <StatusBadge transfer={selectedTransfer} status={selectedTransfer.status} fulfillmentStatus={selectedTransfer.fulfillmentStatus} />
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

                {isBorrowTransfer(selectedTransfer) ? (() => {
                  const bDetails = getBorrowDetails(selectedTransfer);
                  const bStatus = bDetails?.status;
                  const isTransferredIn = ["POSTED"].includes(selectedTransfer.status) || selectedTransfer.fulfillmentStatus === "RECEIVED" || Boolean(selectedTransfer.receivedAt);
                  const isSourceMgr = user?.role === "SUPER_OWNER" || selectedTransfer.fromBranchId === user?.branchId;
                  const isDestMgr = user?.role === "SUPER_OWNER" || selectedTransfer.toBranchId === user?.branchId;

                  return (
                    <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 text-xs space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-200/80 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-purple-900 uppercase tracking-wide">Inter-Branch Stock Borrow</span>
                          <BorrowBadge transfer={selectedTransfer} />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleOpenLoanSlip(selectedTransfer)}
                            className="inline-flex items-center gap-1 rounded-lg bg-purple-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-purple-800 transition shadow-2xs"
                          >
                            <Printer size={13} /> Print Borrow Slip
                          </button>

                          {isTransferredIn && bStatus === "ON_BORROW" && isDestMgr ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenInitiateReturn(selectedTransfer)}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 transition shadow-2xs"
                              >
                                <RotateCcw size={13} /> Isoli (Palitan ng Bago)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenInitiatePurchase(selectedTransfer)}
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-[11px] font-bold text-blue-800 hover:bg-blue-50 transition shadow-2xs"
                              >
                                <CheckCircle2 size={13} /> Babayaran Nalang
                              </button>
                            </>
                          ) : null}

                          {isTransferredIn && bStatus === "RETURN_IN_TRANSIT" && isSourceMgr ? (
                            <button
                              type="button"
                              onClick={() => handleOpenConfirmReturn(selectedTransfer)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-800 transition"
                            >
                              <PackageCheck size={13} /> Receive Return (Nasoli Na)
                            </button>
                          ) : null}

                          {isTransferredIn && bStatus === "WAITING_AMOUNT" && isSourceMgr ? (
                            <button
                              type="button"
                              onClick={() => handleOpenSetBilling(selectedTransfer)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-blue-800 transition"
                            >
                              <Send size={13} /> Send Amount (Billing)
                            </button>
                          ) : null}

                          {isTransferredIn && bStatus === "WAITING_PAYMENT" && isDestMgr ? (
                            <button
                              type="button"
                              onClick={() => handleOpenPayBorrow(selectedTransfer)}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-amber-700 transition"
                            >
                              <CreditCard size={13} /> Magbayad (Pay)
                            </button>
                          ) : null}

                          {isTransferredIn && bStatus === "PAYMENT_SUBMITTED" && isSourceMgr ? (
                            <button
                              type="button"
                              onClick={() => handleOpenConfirmPayment(selectedTransfer)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-800 transition"
                            >
                              <CheckCircle2 size={13} /> Confirm Payment Received
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* Information & Settlement Context */}
                      <div className="grid gap-2 sm:grid-cols-2 text-[11px]">
                        <div className="space-y-1">
                          <p className="text-slate-500">Source (Lender): <strong className="text-slate-800">{selectedTransfer.fromBranch?.code || "—"}</strong></p>
                          <p className="text-slate-500">Destination (Borrower): <strong className="text-slate-800">{selectedTransfer.toBranch?.code || "—"}</strong></p>
                          {bDetails?.billingAmount ? (
                            <p className="text-slate-700">Billing Amount: <strong className="text-blue-900 font-mono">₱{Number(bDetails.billingAmount).toLocaleString()}</strong></p>
                          ) : null}
                          {bDetails?.paymentInstructions ? (
                            <p className="text-slate-600">Instructions: <span className="font-semibold">{bDetails.paymentInstructions}</span></p>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          {bDetails?.returnMethod ? (
                            <p className="text-slate-700">Return Method: <strong>{bDetails.returnMethod}</strong> {bDetails.returnCourier ? `(${bDetails.returnCourier})` : ""}</p>
                          ) : null}
                          {bDetails?.returnSerials ? (
                            <p className="text-slate-700">Replacement Serials: <strong className="font-mono text-purple-900">{bDetails.returnSerials}</strong></p>
                          ) : null}
                          {bDetails?.paidAmount ? (
                            <p className="text-emerald-800 font-semibold">Payment: ₱{Number(bDetails.paidAmount).toLocaleString()} via {bDetails.paidMethod || "CASH"} {bDetails.paidRef ? `Ref: ${bDetails.paidRef}` : ""}</p>
                          ) : null}
                        </div>
                      </div>

                      {selectedTransfer.internalNotes ? (
                        <div className="rounded-lg bg-white/80 p-2.5 text-[11px] border border-purple-100 text-slate-700 font-mono">
                          {selectedTransfer.internalNotes}
                        </div>
                      ) : null}
                    </div>
                  );
                })() : null}

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
                    onInitiateReturn={handleOpenInitiateReturn}
                    onConfirmReturn={handleOpenConfirmReturn}
                    onInitiatePurchase={handleOpenInitiatePurchase}
                    onSetBilling={handleOpenSetBilling}
                    onPayBorrow={handleOpenPayBorrow}
                    onConfirmPayment={handleOpenConfirmPayment}
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

      {/* Modal 0: Transfer Out (Delivery vs Pick up & Serials) Modal */}
      {showTransferOutModal && transferOutTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700">
                  Step 2: Fill out Serials & Choose Next Action (Delivery o Pick up)
                </span>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Transfer Out (Dispatch): {transferOutTarget.transferCode}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Route: <strong>{transferOutTarget.fromBranch?.name || transferOutTarget.fromBranch?.code || "Source"}</strong> ➔ <strong>{transferOutTarget.toBranch?.name || transferOutTarget.toBranch?.code || "Destination"}</strong>
                </p>
              </div>
              <button
                aria-label="Close"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                disabled={isSubmittingTransferOut}
                onClick={() => {
                  setShowTransferOutModal(false)
                  setTransferOutTarget(null)
                }}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={handleConfirmTransferOut}>
              <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                {/* Step 1: Serials or Non-serialized Items Summary */}
                {transferOutItems.length > 0 ? (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                        Step 1: Serial Number Assignment (Kailangan bago i-dispatch)
                      </p>
                    </div>

                    {transferOutItems.map((line) => {
                      const selected = transferOutSelectedSerials[line.stockTransferItemId] || []
                      const available = line.availableSerials || []
                      return (
                        <div key={line.stockTransferItemId} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-slate-900">{line.itemName}</span>
                              {line.itemCode ? <span className="ml-1 text-[10px] text-slate-500 font-mono">({line.itemCode})</span> : null}
                            </div>
                            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                              selected.length === line.requiredQuantity
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}>
                              Selected: {selected.length} / {line.requiredQuantity}
                            </span>
                          </div>

                          {available.length === 0 ? (
                            <p className="text-[11px] text-rose-600 italic">
                              Walang available na serial number sa source branch para sa item na ito.
                            </p>
                          ) : (
                            <div>
                              <p className="text-[10px] font-semibold text-slate-500 mb-1">
                                I-click ang serial number na ipapadala:
                              </p>
                              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                                {available.map((s) => {
                                  const isChecked = selected.includes(s.id)
                                  return (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => {
                                        if (isChecked) {
                                          setTransferOutSelectedSerials((prev) => ({
                                            ...prev,
                                            [line.stockTransferItemId]: (prev[line.stockTransferItemId] || []).filter((id) => id !== s.id),
                                          }))
                                        } else {
                                          if (selected.length >= line.requiredQuantity) {
                                            return
                                          }
                                          setTransferOutSelectedSerials((prev) => ({
                                            ...prev,
                                            [line.stockTransferItemId]: [...(prev[line.stockTransferItemId] || []), s.id],
                                          }))
                                        }
                                      }}
                                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-[11px] font-bold border transition ${
                                        isChecked
                                          ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                      }`}
                                    >
                                      {isChecked ? <Check size={11} /> : null}
                                      {s.serialNumber}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-slate-700 text-xs space-y-1">
                    <p className="font-bold text-[11px] text-slate-900 uppercase tracking-wider">Step 1: Items to Transfer Out</p>
                    <p className="text-[11px] text-slate-600">Lahat ng items sa transfer na ito ay non-serialized. Handa na para sa susunod na aksyon.</p>
                    <div className="mt-2 space-y-1">
                      {(transferOutTarget.items || []).map((item) => (
                        <div key={item.id} className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                          <span className="font-medium text-slate-800">{item.item?.itemName || item.description || "Item"}</span>
                          <span className="font-mono font-bold text-slate-900">Qty: {Number(item.quantity || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 2: Next Action: Delivery vs Pick up */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                    Step 2: Susunod na Aksyon (Next Action: Delivery o Pick up) *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTransferOutMethod("DELIVERY")}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                        transferOutMethod === "DELIVERY"
                          ? "border-sky-500 bg-sky-50/80 text-sky-950 ring-2 ring-sky-400/40"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Truck size={15} className={transferOutMethod === "DELIVERY" ? "text-sky-700" : "text-slate-500"} />
                        <span>🚚 Delivery (Out for Delivery)</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Ipapadala gamit ang courier, in-house driver, o delivery service. Magiging Out for Delivery ang status.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransferOutMethod("PICKUP")}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                        transferOutMethod === "PICKUP"
                          ? "border-amber-500 bg-amber-50/80 text-amber-950 ring-2 ring-amber-400/40"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <PackageCheck size={15} className={transferOutMethod === "PICKUP" ? "text-amber-700" : "text-slate-500"} />
                        <span>🏢 Pick up (Branch Pick up)</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Kukunin o pi-pickup-in ng staff mula sa kabilang branch. Magiging Ready for Pick up ang status.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Conditional Fields based on method */}
                {transferOutMethod === "DELIVERY" ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3.5 space-y-3">
                    <p className="font-bold text-[11px] text-sky-900">Delivery Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                          Courier / Driver Name
                        </span>
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-[var(--color-maroon)]"
                          disabled={isSubmittingTransferOut}
                          onChange={(e) => setTransferOutCourier(e.target.value)}
                          placeholder="e.g. Lalamove / Driver Mark"
                          type="text"
                          value={transferOutCourier}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                          Tracking No. / Contact Phone / Plate No.
                        </span>
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-[var(--color-maroon)]"
                          disabled={isSubmittingTransferOut}
                          onChange={(e) => setTransferOutTrackingNo(e.target.value)}
                          placeholder="e.g. 0917-xxx-xxxx / Plate # ABC-1234"
                          type="text"
                          value={transferOutTrackingNo}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-3">
                    <p className="font-bold text-[11px] text-amber-900">Branch Pick up Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                          Authorized Person / Staff Name
                        </span>
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-[var(--color-maroon)]"
                          disabled={isSubmittingTransferOut}
                          onChange={(e) => setTransferOutPickupPerson(e.target.value)}
                          placeholder="e.g. Staff John mula sa Destination Branch"
                          type="text"
                          value={transferOutPickupPerson}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                          Contact / Vehicle Info (Optional)
                        </span>
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-[var(--color-maroon)]"
                          disabled={isSubmittingTransferOut}
                          onChange={(e) => setTransferOutPickupContact(e.target.value)}
                          placeholder="e.g. 0918-xxx-xxxx / Motor: Plate #123"
                          type="text"
                          value={transferOutPickupContact}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Remarks */}
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                    Dispatch Notes / Remarks (Optional)
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isSubmittingTransferOut}
                    onChange={(e) => setTransferOutRemarks(e.target.value)}
                    placeholder="e.g. Iningatan ang packaging, handa na..."
                    type="text"
                    value={transferOutRemarks}
                  />
                </label>
              </div>

              <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                  disabled={isSubmittingTransferOut}
                  onClick={() => {
                    setShowTransferOutModal(false)
                    setTransferOutTarget(null)
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    transferOutMethod === "DELIVERY"
                      ? "bg-sky-600 hover:bg-sky-700"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                  disabled={isSubmittingTransferOut}
                  type="submit"
                >
                  {isSubmittingTransferOut ? (
                    "Processing Transfer Out..."
                  ) : transferOutMethod === "DELIVERY" ? (
                    <>
                      <Truck size={14} /> I-Transfer Out (Out for Delivery)
                    </>
                  ) : (
                    <>
                      <PackageCheck size={14} /> I-Transfer Out (Ready for Pick up)
                    </>
                  )}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {isReceiveModalOpen && receiveModalTransfer ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">
                  {receiveModalTransfer.fulfillmentMethod === "PICKUP" || receiveModalTransfer.fulfillmentStatus === "READY_FOR_PICKUP"
                    ? (user?.branchId === receiveModalTransfer.fromBranchId ? "Step 2 · Pick up & Release Acknowledgement" : "Step 2 · Pick up & Claim Acknowledgement")
                    : (user?.branchId === receiveModalTransfer.fromBranchId ? "Step 2 · Delivery Completion Acknowledgement" : "Step 2 · Delivery Receipt & Acknowledgement")}
                </span>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  {receiveModalTransfer.fulfillmentMethod === "PICKUP" || receiveModalTransfer.fulfillmentStatus === "READY_FOR_PICKUP"
                    ? (user?.branchId === receiveModalTransfer.fromBranchId ? `Confirm Claimed / Released: ${receiveModalTransfer.transferCode}` : `Confirm Claimed (Pick up): ${receiveModalTransfer.transferCode}`)
                    : (user?.branchId === receiveModalTransfer.fromBranchId ? `Confirm Delivered: ${receiveModalTransfer.transferCode}` : `Confirm Received (Delivery): ${receiveModalTransfer.transferCode}`)}
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
              <div className={`rounded-xl border p-3.5 space-y-1 ${
                receiveModalTransfer.fulfillmentMethod === "PICKUP" || receiveModalTransfer.fulfillmentStatus === "READY_FOR_PICKUP"
                  ? "border-amber-200 bg-amber-50/75 text-amber-950"
                  : "border-sky-200 bg-sky-50/75 text-sky-950"
              }`}>
                <p className="font-bold text-xs flex items-center gap-1.5">
                  {receiveModalTransfer.fulfillmentMethod === "PICKUP" || receiveModalTransfer.fulfillmentStatus === "READY_FOR_PICKUP" ? (
                    <>
                      <PackageCheck size={15} className="text-amber-700" />
                      <span>Kumpirmahin ang Pag-Claim (Branch Pick up Acknowledgement)</span>
                    </>
                  ) : (
                    <>
                      <Truck size={15} className="text-sky-700" />
                      <span>Kumpirmahin ang Natanggap na Delivery (Delivery Receipt Acknowledgement)</span>
                    </>
                  )}
                </p>
                <p className="text-[11px] text-slate-700">
                  {receiveModalTransfer.fulfillmentMethod === "PICKUP" || receiveModalTransfer.fulfillmentStatus === "READY_FOR_PICKUP"
                    ? (user?.branchId === receiveModalTransfer.fromBranchId
                        ? "Kumpirmahin na na-claim at na-release na ang stock sa claimant o authorized staff mula sa destination branch. Pagka-kumpirma, opisyal na itong mapapasok sa inventory ng kabilang branch."
                        : "Pakisuri ang mga items at serial numbers na na-claim/nakuha ng inyong branch. Pagka-kumpirma, opisyal na itong maipapasok sa inventory ng inyong branch.")
                    : (user?.branchId === receiveModalTransfer.fromBranchId
                        ? "Kumpirmahin na natanggap/naihatid na ng courier ang stock sa destination branch. Pagka-kumpirma, opisyal na itong mapapasok sa inventory ng kabilang branch."
                        : "Pakisuri ang mga items at serial numbers na naihatid ng delivery/courier. Pagka-kumpirma, opisyal na itong maipapasok sa inventory ng inyong branch.")}
                </p>
                {receiveModalTransfer.fulfillmentReference ? (
                  <div className="pt-1 text-[11px] font-mono font-semibold text-slate-800">
                    {receiveModalTransfer.fulfillmentMethod === "PICKUP" || receiveModalTransfer.fulfillmentStatus === "READY_FOR_PICKUP"
                      ? `Authorized Staff / Contact: ${receiveModalTransfer.fulfillmentReference}`
                      : `Courier / Tracking / Plate Reference: ${receiveModalTransfer.fulfillmentReference}`}
                  </div>
                ) : null}
                <div className="pt-1 flex items-center gap-4 text-[11px] font-semibold text-slate-600">
                  <span>Source (Galing sa): <strong className="text-slate-900">{receiveModalTransfer.fromBranch?.name || receiveModalTransfer.fromBranch?.code}</strong></span>
                  <span>Destination (Tumatanggap): <strong className="text-slate-900">{receiveModalTransfer.toBranch?.name || receiveModalTransfer.toBranch?.code}</strong></span>
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
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-2xs transition disabled:opacity-50 ${
                  receiveModalTransfer.fulfillmentMethod === "PICKUP" || receiveModalTransfer.fulfillmentStatus === "READY_FOR_PICKUP"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
                disabled={isReceiving}
                onClick={handleConfirmReceive}
                type="button"
              >
                <PackageCheck size={15} />
                {isReceiving
                  ? "Processing..."
                  : receiveModalTransfer.fulfillmentMethod === "PICKUP" || receiveModalTransfer.fulfillmentStatus === "READY_FOR_PICKUP"
                  ? (user?.branchId === receiveModalTransfer.fromBranchId ? "Kumpirmahin na Na-claim / Na-release" : "Kumpirmahin na Na-claim (Confirm Claimed)")
                  : (user?.branchId === receiveModalTransfer.fromBranchId ? "Kumpirmahin na Naihatid (Confirm Delivered)" : "Kumpirmahin na Natanggap (Confirm Received)")}
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
      {/* Modal 1: Initiate Return / Replace with New (Isoli) */}
      {showInitiateReturnModal && initiateReturnTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">
                  Step 1: Isoli (Papalitan ng Bago)
                </span>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Dispatch Return: {initiateReturnTarget.transferCode}
                </h3>
              </div>
              <button
                aria-label="Close"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                disabled={isSubmittingInitiateReturn}
                onClick={() => {
                  setShowInitiateReturnModal(false)
                  setInitiateReturnTarget(null)
                }}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={handleConfirmInitiateReturn}>
              <div className="p-5 space-y-4 text-xs">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-900 space-y-1">
                  <p className="font-bold text-xs">Mag-dispatch ng Replacement Stock Pabalik sa Source Branch</p>
                  <p className="text-[11px] text-emerald-800">
                    Ilagay ang details ng ipinapadalang unit (serial numbers kung meron) at paraan ng delivery/pickup. Pagka-dispatch, mapupunta ito sa Out of Delivery (Returning).
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                      Dispatch Method
                    </span>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                      disabled={isSubmittingInitiateReturn}
                      onChange={(e) => setInitiateReturnMethod(e.target.value)}
                      value={initiateReturnMethod}
                    >
                      <option value="DELIVERY">Delivery (Courier / Out for Delivery)</option>
                      <option value="PICKUP">Pick up by Source Branch</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                      Condition
                    </span>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                      disabled={isSubmittingInitiateReturn}
                      onChange={(e) => setInitiateReturnCondition(e.target.value)}
                      value={initiateReturnCondition}
                    >
                      <option value="Brand New Replacement">Brand New Replacement</option>
                      <option value="Good Condition">Good Condition (Tested)</option>
                      <option value="Complete with Packaging">Complete with Packaging</option>
                      <option value="Minor Wear">Minor Wear</option>
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Courier / Driver / Tracking Reference (Optional)
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isSubmittingInitiateReturn}
                    onChange={(e) => setInitiateReturnCourier(e.target.value)}
                    placeholder="e.g. Lalamove / In-house driver Mark (0917xxx)..."
                    type="text"
                    value={initiateReturnCourier}
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Serial Number(s) ng Isinosoli / Replacement (Kung Meron)
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 font-mono outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isSubmittingInitiateReturn}
                    onChange={(e) => setInitiateReturnSerials(e.target.value)}
                    placeholder="e.g. SN-98721, SN-98722 (comma-separated kung marami)"
                    type="text"
                    value={initiateReturnSerials}
                  />
                  <p className="mt-1 text-[10px] text-slate-500">I-input ang serial number ng ipapalit na bago o isinosoling unit.</p>
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Remarks / Notes (Optional)
                  </span>
                  <textarea
                    className="mt-1 min-h-16 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isSubmittingInitiateReturn}
                    onChange={(e) => setInitiateReturnRemarks(e.target.value)}
                    placeholder="Notes para sa source branch..."
                    value={initiateReturnRemarks}
                  />
                </label>
              </div>

              <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                  disabled={isSubmittingInitiateReturn}
                  onClick={() => {
                    setShowInitiateReturnModal(false)
                    setInitiateReturnTarget(null)
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 transition disabled:opacity-50"
                  disabled={isSubmittingInitiateReturn}
                  type="submit"
                >
                  {isSubmittingInitiateReturn ? "Processing..." : "I-transfer Out Pabalik (Dispatch Return)"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal 2: Confirm Return Received (Nasoli Na) */}
      {showConfirmReturnModal && confirmReturnTarget ? (() => {
        const bDetails = getBorrowDetails(confirmReturnTarget);
        return (
          <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
            <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">
                    Step 2: Kumpirmahin na Nasoli Na
                  </span>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    Confirm Return Receipt: {confirmReturnTarget.transferCode}
                  </h3>
                </div>
                <button
                  aria-label="Close"
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  disabled={isSubmittingConfirmReturn}
                  onClick={() => {
                    setShowConfirmReturnModal(false)
                    setConfirmReturnTarget(null)
                  }}
                  type="button"
                >
                  <X size={16} />
                </button>
              </header>

              <form onSubmit={handleConfirmConfirmReturn}>
                <div className="p-5 space-y-4 text-xs">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-900 space-y-1">
                    <p className="font-bold text-xs">Tanggapin ang Isinoli o Ipinalit na Stock</p>
                    <p className="text-[11px] text-emerald-800">
                      I-kumpirma na natanggap mo na ang replacement stock sa iyong branch. Kapag kinumpirma, mamamarkahan ito bilang NASOLI NA (Completed).
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-1.5 text-[11px]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dispatch Details</p>
                    <p>Method: <strong>{bDetails?.returnMethod || "DELIVERY"}</strong></p>
                    {bDetails?.returnCourier ? <p>Courier / Reference: <strong>{bDetails.returnCourier}</strong></p> : null}
                    {bDetails?.returnCondition ? <p>Declared Condition: <strong>{bDetails.returnCondition}</strong></p> : null}
                    {bDetails?.returnSerials ? (
                      <p>Replacement Serial(s): <strong className="font-mono text-emerald-800">{bDetails.returnSerials}</strong></p>
                    ) : null}
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                      Inspection / Confirmation Remarks (Optional)
                    </span>
                    <textarea
                      className="mt-1 min-h-16 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                      disabled={isSubmittingConfirmReturn}
                      onChange={(e) => setConfirmReturnRemarks(e.target.value)}
                      placeholder="e.g. Received in good order and verified serial number..."
                      value={confirmReturnRemarks}
                    />
                  </label>
                </div>

                <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                    disabled={isSubmittingConfirmReturn}
                    onClick={() => {
                      setShowConfirmReturnModal(false)
                      setConfirmReturnTarget(null)
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 transition disabled:opacity-50"
                    disabled={isSubmittingConfirmReturn}
                    type="submit"
                  >
                    {isSubmittingConfirmReturn ? "Processing..." : "Kumpirmahin na Natanggap (Nasoli Na)"}
                  </button>
                </footer>
              </form>
            </div>
          </div>
        );
      })() : null}

      {/* Modal 3: Initiate Purchase (Babayaran Nalang Request) */}
      {showInitiatePurchaseModal && initiatePurchaseTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-700">
                  Step 1: Babayaran Nalang
                </span>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Convert to Purchase: {initiatePurchaseTarget.transferCode}
                </h3>
              </div>
              <button
                aria-label="Close"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                disabled={isSubmittingInitiatePurchase}
                onClick={() => {
                  setShowInitiatePurchaseModal(false)
                  setInitiatePurchaseTarget(null)
                }}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={handleConfirmInitiatePurchase}>
              <div className="p-5 space-y-4 text-xs">
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-blue-900 space-y-1">
                  <p className="font-bold text-xs">Humiling na Bayaran Nalang ang Hiniram na Stock</p>
                  <p className="text-[11px] text-blue-800">
                    Hindi na isasauli ang stock. Magpapadala ang source branch ng amount na kailangang bayaran at mga payment instructions.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Items to Purchase</p>
                  {(initiatePurchaseTarget.items || []).map((it) => (
                    <div key={it.id} className="flex justify-between items-center text-[11px] font-medium text-slate-800">
                      <span>{it.item?.itemName || it.description || "Item"}</span>
                      <span className="font-mono font-bold">Qty {it.quantity}</span>
                    </div>
                  ))}
                </div>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Remarks / Reason for Purchase (Optional)
                  </span>
                  <textarea
                    className="mt-1 min-h-16 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isSubmittingInitiatePurchase}
                    onChange={(e) => setInitiatePurchaseRemarks(e.target.value)}
                    placeholder="e.g. Decided to keep stock for customer repair..."
                    value={initiatePurchaseRemarks}
                  />
                </label>
              </div>

              <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                  disabled={isSubmittingInitiatePurchase}
                  onClick={() => {
                    setShowInitiatePurchaseModal(false)
                    setInitiatePurchaseTarget(null)
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-blue-800 transition disabled:opacity-50"
                  disabled={isSubmittingInitiatePurchase}
                  type="submit"
                >
                  {isSubmittingInitiatePurchase ? "Processing..." : "I-send ang Request (Babayaran Nalang)"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal 4: Set Billing Amount (Source Branch Sets Amount) */}
      {showSetBillingModal && setBillingTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-700">
                  Step 2: I-set ang Babayaran (Billing)
                </span>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Set Billing Amount: {setBillingTarget.transferCode}
                </h3>
              </div>
              <button
                aria-label="Close"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                disabled={isSubmittingSetBilling}
                onClick={() => {
                  setShowSetBillingModal(false)
                  setSetBillingTarget(null)
                }}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={handleConfirmSetBilling}>
              <div className="p-5 space-y-4 text-xs">
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-blue-900 space-y-1">
                  <p className="font-bold text-xs">Ipadala ang Halaga na Babayaran</p>
                  <p className="text-[11px] text-blue-800">
                    Bilang nagbigay ng stock, i-input ang eksaktong halaga na dapat bayaran ng kabilang branch at payment instructions (e.g. GCash number o account).
                  </p>
                </div>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Halaga na Babayaran (₱) *
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isSubmittingSetBilling}
                    min="0"
                    onChange={(e) => setBillingAmountInput(e.target.value)}
                    placeholder="0.00"
                    required
                    step="0.01"
                    type="number"
                    value={billingAmountInput}
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Instruksyon sa Pagbabayad (Optional)
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isSubmittingSetBilling}
                    onChange={(e) => setBillingInstructionsInput(e.target.value)}
                    placeholder="e.g. GCash: 0917-xxx-xxxx o Cash Turnover sa opisina"
                    type="text"
                    value={billingInstructionsInput}
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Remarks / Billing Note (Optional)
                  </span>
                  <textarea
                    className="mt-1 min-h-16 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isSubmittingSetBilling}
                    onChange={(e) => setBillingRemarksInput(e.target.value)}
                    placeholder="Additional notes para sa kabilang branch..."
                    value={billingRemarksInput}
                  />
                </label>
              </div>

              <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                  disabled={isSubmittingSetBilling}
                  onClick={() => {
                    setShowSetBillingModal(false)
                    setSetBillingTarget(null)
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-blue-800 transition disabled:opacity-50"
                  disabled={isSubmittingSetBilling}
                  type="submit"
                >
                  {isSubmittingSetBilling ? "Processing..." : "I-send ang Halaga (Billing)"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal 5: Pay Borrowed Stock (Borrower Submits Payment) */}
      {showPayBorrowModal && payBorrowTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700">
                  Step 3: Magbayad (Pay Stock)
                </span>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Payment for: {payBorrowTarget.transferCode}
                </h3>
              </div>
              <button
                aria-label="Close"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                disabled={isSubmittingPayBorrow}
                onClick={() => {
                  setShowPayBorrowModal(false)
                  setPayBorrowTarget(null)
                }}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={handleConfirmPayBorrow}>
              <div className="p-5 space-y-4 text-xs">
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-amber-900 space-y-1">
                  <p className="font-bold text-xs">Magbayad sa Source Branch</p>
                  <p className="text-[11px] text-amber-800">
                    I-record ang mode ng payment (Cash, GCash, Bank Transfer) at reference number kung mayroon.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                      Amount to Pay (₱) *
                    </span>
                    <input
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)]"
                      disabled={isSubmittingPayBorrow}
                      min="0"
                      onChange={(e) => setPayAmountInput(e.target.value)}
                      required
                      step="0.01"
                      type="number"
                      value={payAmountInput}
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                      Mode of Payment *
                    </span>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                      disabled={isSubmittingPayBorrow}
                      onChange={(e) => setPayMethodInput(e.target.value)}
                      value={payMethodInput}
                    >
                      <option value="CASH">Cash</option>
                      <option value="GCASH">GCash</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="OTHER">Others</option>
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Reference / Transaction No. (Kung GCash o Bank)
                  </span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isSubmittingPayBorrow}
                    onChange={(e) => setPayRefInput(e.target.value)}
                    placeholder="e.g. GCash Ref 1002938192 o Deposit Slip #"
                    type="text"
                    value={payRefInput}
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Payment Remarks / Notes (Optional)
                  </span>
                  <textarea
                    className="mt-1 min-h-16 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={isSubmittingPayBorrow}
                    onChange={(e) => setPayRemarksInput(e.target.value)}
                    placeholder="Notes..."
                    value={payRemarksInput}
                  />
                </label>
              </div>

              <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                  disabled={isSubmittingPayBorrow}
                  onClick={() => {
                    setShowPayBorrowModal(false)
                    setPayBorrowTarget(null)
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-amber-700 transition disabled:opacity-50"
                  disabled={isSubmittingPayBorrow}
                  type="submit"
                >
                  {isSubmittingPayBorrow ? "Processing..." : "I-submit ang Bayad"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal 6: Confirm Payment Received (Source Branch Confirms) */}
      {showConfirmPaymentModal && confirmPaymentTarget ? (() => {
        const bDetails = getBorrowDetails(confirmPaymentTarget);
        return (
          <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
            <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">
                    Step 4: Kumpirmahin ang Bayad
                  </span>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    Confirm Payment: {confirmPaymentTarget.transferCode}
                  </h3>
                </div>
                <button
                  aria-label="Close"
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  disabled={isSubmittingConfirmPayment}
                  onClick={() => {
                    setShowConfirmPaymentModal(false)
                    setConfirmPaymentTarget(null)
                  }}
                  type="button"
                >
                  <X size={16} />
                </button>
              </header>

              <form onSubmit={handleConfirmConfirmPayment}>
                <div className="p-5 space-y-4 text-xs">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-900 space-y-1">
                    <p className="font-bold text-xs">Kumpirmahin na Natanggap ang Bayad</p>
                    <p className="text-[11px] text-emerald-800">
                      Tingnan ang detalye ng bayad sa ibaba. Kapag kinumpirma mo na natanggap mo na ito, makukumpleto ang buong transaksyon bilang BABAYARAN NALANG (Paid & Completed).
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2 text-[11px]">
                    <div className="flex justify-between items-center font-bold text-slate-900">
                      <span>Halagang Ibinayad:</span>
                      <span className="text-base font-mono font-black text-emerald-700">₱{Number(bDetails?.paidAmount || bDetails?.billingAmount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Mode of Payment:</span>
                      <span className="font-bold text-slate-800">{bDetails?.paidMethod || "CASH"}</span>
                    </div>
                    {bDetails?.paidRef ? (
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Reference No:</span>
                        <span className="font-mono font-bold text-slate-800">{bDetails.paidRef}</span>
                      </div>
                    ) : null}
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                      Confirmation Remarks (Optional)
                    </span>
                    <textarea
                      className="mt-1 min-h-16 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)]"
                      disabled={isSubmittingConfirmPayment}
                      onChange={(e) => setConfirmPaymentRemarks(e.target.value)}
                      placeholder="e.g. Payment verified in GCash account / cash accepted..."
                      value={confirmPaymentRemarks}
                    />
                  </label>
                </div>

                <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                    disabled={isSubmittingConfirmPayment}
                    onClick={() => {
                      setShowConfirmPaymentModal(false)
                      setConfirmPaymentTarget(null)
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 transition disabled:opacity-50"
                    disabled={isSubmittingConfirmPayment}
                    type="submit"
                  >
                    {isSubmittingConfirmPayment ? "Processing..." : "Kumpirmahin ang Bayad (Complete Transaction)"}
                  </button>
                </footer>
              </form>
            </div>
          </div>
        );
      })() : null}
    </div>
  )
}

