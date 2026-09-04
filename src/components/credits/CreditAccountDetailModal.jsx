import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertCircle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  Receipt,
  RefreshCw,
  X,
} from "lucide-react"

import {
  cancelCreditCollection,
  createCreditCollection,
  declareCreditAccountDefaulted,
  getCreditAccountById,
} from "../../features/credit-accounts/creditAccounts.api"
import { generateUUID } from "../../utils/uuid"
import { getUser } from "../../lib/sessionStorage"

const PAYMENT_METHODS = ["CASH", "GCASH", "BANK_TRANSFER", "CARD", "OTHER"]

function money(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function dateTime(value, dateOnly = false) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return dateOnly
    ? date.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })
    : date.toLocaleString("en-PH", { timeZone: "Asia/Manila" })
}

function label(value) {
  if (!value) return "—"
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function isOverdue(account) {
  if (!account?.nextDueDate || account.status !== "ACTIVE") return false
  const dueDate = new Date(account.nextDueDate)
  if (Number.isNaN(dueDate.getTime())) return false
  return dueDate.getTime() < Date.now()
}

function StatusBadge({ value }) {
  const normalized = String(value || "UNKNOWN").toUpperCase()
  const color =
    normalized === "PAID" || normalized === "POSTED"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : normalized === "ACTIVE"
        ? "bg-amber-50 text-amber-700 border border-amber-200"
        : "bg-rose-50 text-rose-700 border border-rose-200"

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${color}`}>
      {label(normalized)}
    </span>
  )
}

export default function CreditAccountDetailModal({
  account: initialAccount,
  accountId,
  onClose,
  onSuccess,
}) {
  const navigate = useNavigate()
  const user = getUser()
  const targetId = accountId || initialAccount?.id

  const [detail, setDetail] = useState(initialAccount || null)
  const [isLoading, setIsLoading] = useState(!initialAccount?.collections)
  const [errorMessage, setErrorMessage] = useState("")
  const [noticeMessage, setNoticeMessage] = useState("")
  const [showCollectionForm, setShowCollectionForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDefaultModal, setShowDefaultModal] = useState(false)
  const [defaultReason, setDefaultReason] = useState("")

  const [collectionForm, setCollectionForm] = useState({
    amount: "",
    paymentMethod: "CASH",
    referenceNo: "",
    remarks: "",
    paidAt: "",
  })

  const collectionRequestRef = useRef({ signature: "", key: "" })

  const canCancelCollections = useMemo(() => {
    const role = user?.role
    return role === "SUPER_OWNER" || role === "BRANCH_OWNER" || role === "ADMIN"
  }, [user])

  const loadAccountDetail = useCallback(async () => {
    if (!targetId) return
    setIsLoading(true)
    setErrorMessage("")
    try {
      const response = await getCreditAccountById(targetId)
      if (response?.success && response?.data) {
        setDetail(response.data)
      } else {
        setDetail(response)
      }
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.message ||
          err?.response?.data?.error?.message ||
          "Unable to load credit account details."
      )
    } finally {
      setIsLoading(false)
    }
  }, [targetId])

  useEffect(() => {
    loadAccountDetail()
  }, [loadAccountDetail])

  const submitCollection = async (e) => {
    e.preventDefault()
    if (!detail) return

    const amountNum = Number(collectionForm.amount)
    if (!amountNum || amountNum <= 0) {
      setErrorMessage("Please enter a valid payment amount greater than 0.")
      return
    }

    const remaining = Number(detail.remainingBalance ?? detail.balanceAmount ?? 0)
    if (amountNum > remaining + 0.01) {
      setErrorMessage(`Payment amount cannot exceed the remaining balance of ${money(remaining)}.`)
      return
    }

    setIsSaving(true)
    setErrorMessage("")
    setNoticeMessage("")

    try {
      const collectionPayload = {
        amount: amountNum,
        paymentMethod: collectionForm.paymentMethod,
        referenceNo: collectionForm.referenceNo.trim() || undefined,
        remarks: collectionForm.remarks.trim() || undefined,
        paidAt: collectionForm.paidAt || undefined,
      }

      const requestSignature = JSON.stringify({
        creditAccountId: detail.id,
        ...collectionPayload,
      })

      if (collectionRequestRef.current.signature !== requestSignature) {
        collectionRequestRef.current = {
          signature: requestSignature,
          key: generateUUID(),
        }
      }

      await createCreditCollection(detail.id, {
        ...collectionPayload,
        idempotencyKey: collectionRequestRef.current.key,
      })

      setNoticeMessage(`Payment of ${money(amountNum)} successfully posted to ${detail.creditCode}!`)
      collectionRequestRef.current = { signature: "", key: "" }
      setCollectionForm({
        amount: "",
        paymentMethod: "CASH",
        referenceNo: "",
        remarks: "",
        paidAt: "",
      })
      setShowCollectionForm(false)

      await loadAccountDetail()
      onSuccess?.()
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.message ||
          err?.response?.data?.error?.message ||
          "Failed to post payment collection."
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleReverseCollection = async (collection) => {
    const reason = window.prompt(
      `Reason for reversing payment collection ${collection.collectionCode}?`
    )
    if (!reason?.trim() || isSaving) return

    setIsSaving(true)
    setErrorMessage("")
    setNoticeMessage("")
    try {
      await cancelCreditCollection(collection.id, {
        cancellationReason: reason.trim(),
      })
      setNoticeMessage(`${collection.collectionCode} has been reversed.`)
      await loadAccountDetail()
      onSuccess?.()
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.message ||
          err?.response?.data?.error?.message ||
          "Could not reverse credit collection."
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeclareDefault = async () => {
    if (!detail || !defaultReason.trim() || isSaving) return
    setIsSaving(true)
    setErrorMessage("")
    try {
      await declareCreditAccountDefaulted(detail.id, {
        reason: defaultReason.trim(),
      })
      setShowDefaultModal(false)
      setDefaultReason("")
      setNoticeMessage(`Account ${detail.creditCode} marked as defaulted / bad debt.`)
      await loadAccountDetail()
      onSuccess?.()
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.message ||
          err?.response?.data?.error?.message ||
          "Could not declare default."
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleNavigateToCredits = () => {
    onClose?.()
    navigate("/credits")
  }

  return (
    <div
      aria-labelledby="credit-detail-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-3 sm:p-5 backdrop-blur-xs"
      role="dialog"
    >
      <section className="my-auto w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-900 to-[#002060] p-5 text-white shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-white/20 px-2 py-0.5 font-mono text-xs font-black tracking-wider text-white">
                {detail?.creditCode || "AR Account"}
              </span>
              <StatusBadge value={detail?.status} />
              {isOverdue(detail) ? (
                <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">
                  OVERDUE
                </span>
              ) : null}
            </div>
            <h2 className="mt-1 truncate text-base font-black text-white" id="credit-detail-title">
              {detail?.customer?.fullName ||
                detail?.serviceJob?.customerNameSnapshot ||
                "Customer Credit Account"}
            </h2>
            <p className="text-[11px] text-white/80">
              {detail?.branch?.code ? `Branch: ${detail.branch.code} · ` : ""}
              Opened {dateTime(detail?.createdAt, true)}
              {detail?.sale?.receiptCode ? ` · From Sale ${detail.sale.receiptCode}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
              onClick={handleNavigateToCredits}
              title="Open full Accounts Receivable Page"
              type="button"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">AR Page</span>
            </button>
            <button
              aria-label="Refresh AR account"
              className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20 transition"
              disabled={isLoading}
              onClick={loadAccountDetail}
              type="button"
            >
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={15} />
            </button>
            <button
              aria-label="Close modal"
              className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20 transition"
              onClick={onClose}
              type="button"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 space-y-4 text-xs">
          {errorMessage ? (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {noticeMessage ? (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
              <span>{noticeMessage}</span>
            </div>
          ) : null}

          {isLoading && !detail ? (
            <div className="flex items-center justify-center gap-2 p-12 text-xs font-bold text-slate-400">
              <LoaderCircle className="animate-spin" size={18} />
              Loading credit account and collection ledger…
            </div>
          ) : detail ? (
            <>
              {/* Financial Snapshot Summary */}
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total Regular / Principal</p>
                  <p className="mt-1 font-mono text-base font-black text-slate-900">
                    {money(detail.regularPriceTotalAmount || detail.principalAmount || detail.sourceTotalAmountSnapshot)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <p className="text-[10px] font-black uppercase text-slate-400">Downpayment / Initial</p>
                  <p className="mt-1 font-mono text-base font-black text-slate-900">
                    {money(detail.downpaymentAmount || detail.initialPaymentAmount)}
                  </p>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5">
                  <p className="text-[10px] font-black uppercase text-rose-700">Remaining Balance</p>
                  <p className="mt-1 font-mono text-lg font-black text-rose-700">
                    {money(detail.remainingBalance ?? detail.balanceAmount)}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3.5">
                  <p className="text-[10px] font-black uppercase text-blue-900">Monthly Due</p>
                  <p className="mt-1 font-mono text-base font-black text-blue-950">
                    {money(detail.monthlyDueAmount)}/mo
                  </p>
                </div>
              </div>

              {/* Terms, Due Date & Schedule Details */}
              <div className="grid gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Term & Rate Basis</p>
                  <p className="mt-0.5 font-bold text-slate-800">
                    {detail.term
                      ? `${label(detail.term)} (${Number(detail.termBasis || 1).toFixed(4)})`
                      : "Not applicable"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Due Schedule</p>
                  <p className="mt-0.5 font-bold text-slate-800">
                    {detail.dueDay
                      ? `Day ${detail.dueDay} of month · Next: ${dateTime(detail.nextDueDate, true)}`
                      : "Not applicable"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Provider</p>
                  <p className="mt-0.5 font-bold text-slate-800">{label(detail.provider || "In House Installment")}</p>
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Total Collected</p>
                  <p className="mt-0.5 font-mono font-black text-emerald-700">{money(detail.totalCollected)}</p>
                </div>
              </div>

              {/* Action Buttons: Pay Collection / Declare Bad Debt */}
              {detail.status === "ACTIVE" ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-y border-slate-200 py-3">
                  <button
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-black text-white shadow-soft transition hover:bg-emerald-800"
                    onClick={() => {
                      setShowCollectionForm((val) => !val)
                      if (!collectionForm.amount) {
                        setCollectionForm((form) => ({
                          ...form,
                          amount: String(detail.monthlyDueAmount || detail.remainingBalance || ""),
                        }))
                      }
                    }}
                    type="button"
                  >
                    <Banknote size={16} />
                    {showCollectionForm ? "Hide Payment Form" : "💳 Accept & Post Payment"}
                  </button>

                  {canCancelCollections ? (
                    <button
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                      onClick={() => setShowDefaultModal(true)}
                      type="button"
                    >
                      ⚠️ Declare Bad Debt / Default
                    </button>
                  ) : null}
                </div>
              ) : null}

              {/* Payment Collection Form */}
              {showCollectionForm && detail.status === "ACTIVE" ? (
                <form
                  className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/40 p-4 space-y-3"
                  onSubmit={submitCollection}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                      <Banknote size={15} /> Enter Collection Payment
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        className="rounded-lg bg-white border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-900 hover:bg-emerald-100"
                        onClick={() =>
                          setCollectionForm((f) => ({
                            ...f,
                            amount: String(detail.monthlyDueAmount || ""),
                          }))
                        }
                        type="button"
                      >
                        Monthly Due ({money(detail.monthlyDueAmount)})
                      </button>
                      <button
                        className="rounded-lg bg-white border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-900 hover:bg-emerald-100"
                        onClick={() =>
                          setCollectionForm((f) => ({
                            ...f,
                            amount: String(detail.remainingBalance ?? detail.balanceAmount ?? ""),
                          }))
                        }
                        type="button"
                      >
                        Full Balance ({money(detail.remainingBalance ?? detail.balanceAmount)})
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Amount to Pay</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono font-bold text-slate-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                        max={Number(detail.remainingBalance ?? detail.balanceAmount ?? 0)}
                        min="0.01"
                        onChange={(e) => setCollectionForm((f) => ({ ...f, amount: e.target.value }))}
                        placeholder="0.00"
                        required
                        step="0.01"
                        type="number"
                        value={collectionForm.amount}
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Payment Method</span>
                      <select
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800 outline-none focus:border-emerald-600"
                        onChange={(e) => setCollectionForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                        value={collectionForm.paymentMethod}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {label(m)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Reference No. (optional)</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none focus:border-emerald-600"
                        onChange={(e) => setCollectionForm((f) => ({ ...f, referenceNo: e.target.value }))}
                        placeholder="e.g. GCash Ref / Check No."
                        value={collectionForm.referenceNo}
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Remarks (optional)</span>
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none focus:border-emerald-600"
                        onChange={(e) => setCollectionForm((f) => ({ ...f, remarks: e.target.value }))}
                        placeholder="e.g. Month 1 payment"
                        value={collectionForm.remarks}
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        className="w-full rounded-xl bg-emerald-700 py-2.5 font-bold text-white shadow-soft transition hover:bg-emerald-800 disabled:opacity-50"
                        disabled={isSaving}
                        type="submit"
                      >
                        {isSaving ? "Posting…" : "Confirm Payment"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : null}

              {/* Collections History Table */}
              <section className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <CalendarClock className="text-[var(--color-maroon)]" size={15} />
                  <h3 className="text-xs font-black text-slate-900">
                    Payment Collection History ({(detail.collections || []).length})
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white text-xs">
                  {(detail.collections || []).map((coll) => (
                    <article
                      className="grid gap-2 p-3.5 md:grid-cols-[1fr_auto_auto] md:items-center hover:bg-slate-50/50 transition"
                      key={coll.id}
                    >
                      <div>
                        <p className="font-mono font-bold text-slate-900">{coll.collectionCode || coll.receiptCode}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
                          {dateTime(coll.paidAt || coll.createdAt)} · {label(coll.paymentMethod)} · Collector: {coll.collectedBy?.fullName || coll.cashier?.fullName || "System"}
                        </p>
                        {coll.referenceNo ? (
                          <p className="mt-0.5 font-mono text-[10px] text-slate-400">Ref: {coll.referenceNo}</p>
                        ) : null}
                      </div>

                      <div className="md:text-right">
                        <p className="font-mono font-black text-emerald-700 text-sm">{money(coll.amount || coll.amountPaid)}</p>
                        <StatusBadge value={coll.status || "POSTED"} />
                      </div>

                      {coll.status === "POSTED" && canCancelCollections ? (
                        <button
                          className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 transition"
                          disabled={isSaving}
                          onClick={() => handleReverseCollection(coll)}
                          type="button"
                        >
                          Reverse
                        </button>
                      ) : (
                        <span />
                      )}
                    </article>
                  ))}

                  {(detail.collections || []).length === 0 ? (
                    <p className="p-8 text-center text-xs font-bold text-slate-400">
                      No payment collections recorded for this account yet.
                    </p>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 shrink-0">
          <button
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
            onClick={handleNavigateToCredits}
            type="button"
          >
            <ExternalLink size={13} />
            Go to Full Accounts Receivable Page
          </button>
          <button
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-black transition"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </footer>
      </section>

      {/* Declare Bad Debt Modal */}
      {showDefaultModal && detail ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <h3 className="text-base font-black text-slate-900">Declare Bad Debt / Default</h3>
              </div>
              <button
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                onClick={() => setShowDefaultModal(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to declare <strong>{detail.creditCode}</strong> as defaulted? This write-off will be permanently logged and reflected in AR and bad debt reports.
            </p>

            <textarea
              className="w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-rose-500"
              onChange={(e) => setDefaultReason(e.target.value)}
              placeholder="Reason for write-off / default declaration..."
              rows={3}
              value={defaultReason}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                onClick={() => setShowDefaultModal(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
                disabled={!defaultReason.trim() || isSaving}
                onClick={handleDeclareDefault}
                type="button"
              >
                {isSaving ? "Submitting…" : "Confirm Default Write-Off"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
