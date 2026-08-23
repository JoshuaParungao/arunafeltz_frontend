import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  LoaderCircle,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react"

import {
  cancelCashHandover,
  cancelCashTransaction,
  createCashHandover,
  createCashTransaction,
  getCashBoxes,
  getCashHandovers,
  getCashTransactions,
  receiveCashHandover,
} from "../../features/cash-boxes/cashBoxes.api"
import { getUsers } from "../../features/users/users.api"

const OWNER_ROLES = new Set(["SUPER_OWNER", "ADMIN"])
const CASH_IN_TYPES = new Set(["CASH_IN", "ADJUSTMENT_IN", "SALE_PAYMENT", "CREDIT_COLLECTION", "SERVICE_PAYMENT"])

function money(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function dateTime(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-PH")
}

function apiError(error, fallback) {
  return error?.response?.data?.message || error?.response?.data?.error?.message || fallback
}

function tone(status) {
  if (["ACTIVE", "POSTED", "RECEIVED"].includes(status)) return "bg-emerald-50 text-emerald-700"
  if (["CANCELLED", "INACTIVE"].includes(status)) return "bg-rose-50 text-rose-700"
  return "bg-amber-50 text-amber-700"
}

function Status({ value }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${tone(value)}`}>{String(value || "—").replaceAll("_", " ")}</span>
}

export default function CashBoxesPage({
  hasCashBoxAccess = false,
  selectedBranch,
  user,
}) {
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""
  const canManage = OWNER_ROLES.has(user?.role)
  const canReceive = Boolean(hasCashBoxAccess)
  const [boxes, setBoxes] = useState([])
  const [selectedBoxId, setSelectedBoxId] = useState("")
  const [transactions, setTransactions] = useState([])
  const [transactionMeta, setTransactionMeta] = useState({})
  const [handovers, setHandovers] = useState([])
  const [handoverMeta, setHandoverMeta] = useState({})
  const [staff, setStaff] = useState([])
  const [tab, setTab] = useState("transactions")
  const [transactionPage, setTransactionPage] = useState(1)
  const [handoverPage, setHandoverPage] = useState(1)
  const [transactionSearch, setTransactionSearch] = useState("")
  const [transactionType, setTransactionType] = useState("")
  const [handoverStatus, setHandoverStatus] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [notice, setNotice] = useState("")
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [showHandoverForm, setShowHandoverForm] = useState(false)
  const [transactionForm, setTransactionForm] = useState({ type: "CASH_IN", amount: "", description: "", referenceNo: "", transactionDate: "" })
  const [handoverForm, setHandoverForm] = useState({ amount: "", toUserId: "", remarks: "" })

  const selectedBox = useMemo(
    () => boxes.find((box) => box.id === selectedBoxId) || boxes[0] || null,
    [boxes, selectedBoxId],
  )

  const loadBoxes = useCallback(async () => {
    const response = await getCashBoxes({ ...(branchId ? { branchId } : {}), status: "ACTIVE", limit: 50 })
    const result = response?.data || {}
    const nextBoxes = Array.isArray(result) ? result : result.data || []
    setBoxes(nextBoxes)
    setSelectedBoxId((current) => (nextBoxes.some((box) => box.id === current) ? current : nextBoxes[0]?.id || ""))
  }, [branchId])

  const loadTransactions = useCallback(async () => {
    if (!selectedBoxId) {
      setTransactions([])
      setTransactionMeta({})
      return
    }
    const response = await getCashTransactions(selectedBoxId, {
      ...(transactionSearch.trim() ? { search: transactionSearch.trim() } : {}),
      ...(transactionType ? { type: transactionType } : {}),
      page: transactionPage,
      limit: 20,
    })
    const result = response?.data || {}
    setTransactions(result.data || [])
    setTransactionMeta(result.meta || {})
  }, [selectedBoxId, transactionPage, transactionSearch, transactionType])

  const loadHandovers = useCallback(async () => {
    const response = await getCashHandovers({
      ...(branchId ? { branchId } : {}),
      ...(selectedBoxId ? { cashBoxId: selectedBoxId } : {}),
      ...(handoverStatus ? { status: handoverStatus } : {}),
      page: handoverPage,
      limit: 20,
    })
    setHandovers(Array.isArray(response?.data) ? response.data : [])
    setHandoverMeta(response?.meta || {})
  }, [branchId, handoverPage, handoverStatus, selectedBoxId])

  const loadStaff = useCallback(async () => {
    if (!canManage) return
    const response = await getUsers({ ...(branchId ? { branchId } : {}), status: "ACTIVE", limit: 100 })
    const result = response?.data || {}
    setStaff((Array.isArray(result) ? result : result.data || []).filter((member) => member.role !== "SUPER_OWNER"))
  }, [branchId, canManage])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setMessage("")
    try {
      await Promise.all([loadBoxes(), loadStaff()])
    } catch (error) {
      setMessage(apiError(error, "Could not load cash boxes."))
    } finally {
      setIsLoading(false)
    }
  }, [loadBoxes, loadStaff])

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        if (tab === "transactions") await loadTransactions()
        if (tab === "handovers") await loadHandovers()
      } catch (error) {
        setMessage(apiError(error, "Could not load cash history."))
      }
    }, 200)
    return () => window.clearTimeout(timer)
  }, [loadHandovers, loadTransactions, tab])

  const reloadActiveTab = async () => {
    await loadBoxes()
    if (tab === "transactions") await loadTransactions()
    else await loadHandovers()
  }

  const submitTransaction = async (event) => {
    event.preventDefault()
    if (!selectedBox || isSaving) return
    setIsSaving(true)
    setMessage("")
    try {
      await createCashTransaction(selectedBox.id, {
        type: transactionForm.type,
        amount: Number(transactionForm.amount),
        description: transactionForm.description.trim(),
        referenceNo: transactionForm.referenceNo.trim() || undefined,
        transactionDate: transactionForm.transactionDate || undefined,
      })
      setNotice("Cash transaction posted successfully.")
      setTransactionForm({ type: "CASH_IN", amount: "", description: "", referenceNo: "", transactionDate: "" })
      setShowTransactionForm(false)
      await reloadActiveTab()
    } catch (error) {
      setMessage(apiError(error, "Could not post cash transaction."))
    } finally {
      setIsSaving(false)
    }
  }

  const submitHandover = async (event) => {
    event.preventDefault()
    if (!selectedBox || isSaving) return
    setIsSaving(true)
    setMessage("")
    try {
      await createCashHandover(selectedBox.id, {
        amount: Number(handoverForm.amount),
        toUserId: handoverForm.toUserId || undefined,
        remarks: handoverForm.remarks.trim() || undefined,
      })
      setNotice("Cash handover request created.")
      setHandoverForm({ amount: "", toUserId: "", remarks: "" })
      setShowHandoverForm(false)
      setTab("handovers")
      await reloadActiveTab()
    } catch (error) {
      setMessage(apiError(error, "Could not create cash handover."))
    } finally {
      setIsSaving(false)
    }
  }

  const reverseTransaction = async (transaction) => {
    const reason = window.prompt(`Reason for reversing ${transaction.transactionCode}?`)
    if (!reason?.trim()) return
    setIsSaving(true)
    try {
      await cancelCashTransaction(transaction.id, { cancellationReason: reason.trim() })
      setNotice(`${transaction.transactionCode} reversed with an audit trail.`)
      await reloadActiveTab()
    } catch (error) {
      setMessage(apiError(error, "Could not reverse transaction."))
    } finally {
      setIsSaving(false)
    }
  }

  const actOnHandover = async (handover, action) => {
    if (isSaving) return
    const isReceive = action === "receive"
    const reason = isReceive ? window.prompt("Optional receiving remarks:", "") : window.prompt("Cancellation reason:")
    if (!isReceive && !reason?.trim()) return
    setIsSaving(true)
    setMessage("")
    try {
      if (isReceive) await receiveCashHandover(handover.id, { remarks: reason?.trim() || undefined })
      else await cancelCashHandover(handover.id, { cancellationReason: reason.trim() })
      setNotice(`${handover.handoverCode} ${isReceive ? "received" : "cancelled"}.`)
      await reloadActiveTab()
    } catch (error) {
      setMessage(apiError(error, `Could not ${action} cash handover.`))
    } finally {
      setIsSaving(false)
    }
  }

  const transactionPages = Math.max(1, transactionMeta.totalPages || 1)
  const handoverPages = Math.max(1, handoverMeta.totalPages || 1)

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-maroon)]">Finance</p><h1 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">Cash Box</h1><p className="mt-1 text-sm text-[var(--color-muted)]">Central branch cash ledger, manual movements, linked collections, and custodian handovers.</p></div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold" disabled={isLoading} onClick={refresh} type="button"><RefreshCw className={isLoading ? "animate-spin" : ""} size={16} />Refresh</button>
            {canManage ? <button className="rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-bold text-white" disabled={!selectedBox} onClick={() => setShowTransactionForm((value) => !value)} type="button">Post cash movement</button> : null}
            {canManage ? <button className="rounded-xl bg-[var(--color-gold)] px-4 py-2.5 text-sm font-black text-[var(--color-text-strong)]" disabled={!selectedBox} onClick={() => setShowHandoverForm((value) => !value)} type="button">New handover</button> : null}
          </div>
        </div>
      </section>

      {message ? <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{message}</div> : null}
      {notice ? <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div> : null}

      <section className="grid gap-4 md:grid-cols-[minmax(240px,360px)_1fr]">
        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <label className="text-xs font-black uppercase tracking-wide text-[var(--color-muted)]" htmlFor="active-cash-box">Active cash box</label>
          <select className="mt-2 w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm font-bold" id="active-cash-box" onChange={(event) => { setSelectedBoxId(event.target.value); setTransactionPage(1); setHandoverPage(1) }} value={selectedBoxId}>{boxes.length === 0 ? <option value="">No active cash box</option> : null}{boxes.map((box) => <option key={box.id} value={box.id}>{box.boxCode} · {box.name}</option>)}</select>
          {selectedBox ? <div className="mt-5 rounded-2xl bg-[var(--color-soft)] p-5"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-white text-[var(--color-maroon)]"><Banknote size={20} /></span><div><p className="text-xs font-bold text-[var(--color-muted)]">Current balance</p><p className="text-2xl font-black text-[var(--color-text-strong)]">{money(selectedBox.currentBalance)}</p></div></div><div className="mt-4 flex items-center justify-between text-sm"><span>{selectedBox.branch?.code}</span><Status value={selectedBox.status} /></div></div> : <p className="mt-5 text-sm text-[var(--color-muted)]">No cash box is configured for this branch.</p>}
        </div>

        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <h2 className="font-black text-[var(--color-text-strong)]">Control notes</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-bold text-[var(--color-muted)]">Historical safety</p><p className="mt-2 text-sm font-semibold">Posted entries are reversed by status and balance adjustment, never deleted.</p></div><div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-bold text-[var(--color-muted)]">Linked collections</p><p className="mt-2 text-sm font-semibold">Cash sales, credit collections, and service payments post automatically.</p></div><div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-bold text-[var(--color-muted)]">Custodian access</p><p className="mt-2 text-sm font-semibold">Only the currently assigned branch cash custodian can inspect staff-level Cash Box data and confirm pending handovers.</p></div></div>
        </div>
      </section>

      {showTransactionForm && canManage ? <form className="grid gap-3 rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card md:grid-cols-2 xl:grid-cols-5" onSubmit={submitTransaction}><select className="rounded-xl border px-3 py-3 text-sm" onChange={(event) => setTransactionForm((form) => ({ ...form, type: event.target.value }))} value={transactionForm.type}><option value="CASH_IN">Cash in</option><option value="CASH_OUT">Cash out</option><option value="ADJUSTMENT_IN">Adjustment in</option><option value="ADJUSTMENT_OUT">Adjustment out</option></select><input className="rounded-xl border px-3 py-3 text-sm" min="0.01" onChange={(event) => setTransactionForm((form) => ({ ...form, amount: event.target.value }))} placeholder="Amount" required step="0.01" type="number" value={transactionForm.amount} /><input className="rounded-xl border px-3 py-3 text-sm" minLength={3} onChange={(event) => setTransactionForm((form) => ({ ...form, description: event.target.value }))} placeholder="Description" required value={transactionForm.description} /><input className="rounded-xl border px-3 py-3 text-sm" onChange={(event) => setTransactionForm((form) => ({ ...form, referenceNo: event.target.value }))} placeholder="Reference (optional)" value={transactionForm.referenceNo} /><button className="rounded-xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={isSaving} type="submit">{isSaving ? "Posting..." : "Post movement"}</button></form> : null}

      {showHandoverForm && canManage ? <form className="grid gap-3 rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card md:grid-cols-2 xl:grid-cols-4" onSubmit={submitHandover}><input className="rounded-xl border px-3 py-3 text-sm" min="0.01" onChange={(event) => setHandoverForm((form) => ({ ...form, amount: event.target.value }))} placeholder="Handover amount" required step="0.01" type="number" value={handoverForm.amount} /><select className="rounded-xl border px-3 py-3 text-sm" onChange={(event) => setHandoverForm((form) => ({ ...form, toUserId: event.target.value }))} value={handoverForm.toUserId}><option value="">Open branch handover</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.fullName} · {member.role.replaceAll("_", " ")}</option>)}</select><input className="rounded-xl border px-3 py-3 text-sm" onChange={(event) => setHandoverForm((form) => ({ ...form, remarks: event.target.value }))} placeholder="Remarks (optional)" value={handoverForm.remarks} /><button className="rounded-xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={isSaving} type="submit">Create handover</button></form> : null}

      <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        <div className="flex border-b border-[var(--color-border)] p-2"><button className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black ${tab === "transactions" ? "bg-[var(--color-maroon)] text-white" : "text-[var(--color-muted)]"}`} onClick={() => setTab("transactions")} type="button">Transactions</button><button className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black ${tab === "handovers" ? "bg-[var(--color-maroon)] text-white" : "text-[var(--color-muted)]"}`} onClick={() => setTab("handovers")} type="button">Handovers</button></div>

        {tab === "transactions" ? <><div className="grid gap-3 border-b p-4 md:grid-cols-2"><label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" size={16} /><input className="w-full rounded-xl border py-3 pl-10 pr-3 text-sm" onChange={(event) => { setTransactionSearch(event.target.value); setTransactionPage(1) }} placeholder="Search code, reference, description" value={transactionSearch} /></label><select className="rounded-xl border px-3 py-3 text-sm" onChange={(event) => { setTransactionType(event.target.value); setTransactionPage(1) }} value={transactionType}><option value="">All transaction types</option>{["CASH_IN", "CASH_OUT", "SALE_PAYMENT", "CREDIT_COLLECTION", "SERVICE_PAYMENT", "HANDOVER_OUT", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></div><div className="divide-y">{transactions.map((entry) => { const isIn = CASH_IN_TYPES.has(entry.type); return <article className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center" key={entry.id}><div className="flex min-w-0 items-start gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${isIn ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{isIn ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><div className="min-w-0"><p className="truncate font-black text-[var(--color-text-strong)]">{entry.transactionCode}</p><p className="mt-1 text-sm text-[var(--color-muted)]">{entry.description}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{dateTime(entry.transactionDate)} · {entry.type.replaceAll("_", " ")} · {entry.source.replaceAll("_", " ")}</p></div></div><div className="text-left md:text-right"><p className={`font-black ${isIn ? "text-emerald-700" : "text-rose-700"}`}>{isIn ? "+" : "−"}{money(entry.amount)}</p><Status value={entry.status} /></div>{canManage && entry.status === "POSTED" && entry.source === "MANUAL" ? <button className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700" disabled={isSaving} onClick={() => reverseTransaction(entry)} type="button">Reverse</button> : <span />}</article>})}{!isLoading && transactions.length === 0 ? <p className="p-8 text-center text-sm text-[var(--color-muted)]">No matching cash transactions.</p> : null}</div><div className="flex items-center justify-between border-t p-4"><p className="text-sm text-[var(--color-muted)]">Page {transactionMeta.page || transactionPage} of {transactionPages}</p><div className="flex gap-2"><button className="rounded-xl border p-2 disabled:opacity-30" disabled={transactionPage <= 1} onClick={() => setTransactionPage((page) => Math.max(1, page - 1))} type="button"><ChevronLeft size={18} /></button><button className="rounded-xl border p-2 disabled:opacity-30" disabled={transactionPage >= transactionPages} onClick={() => setTransactionPage((page) => page + 1)} type="button"><ChevronRight size={18} /></button></div></div></> : null}

        {tab === "handovers" ? <><div className="border-b p-4"><select className="w-full rounded-xl border px-3 py-3 text-sm md:max-w-xs" onChange={(event) => { setHandoverStatus(event.target.value); setHandoverPage(1) }} value={handoverStatus}><option value="">All handover statuses</option><option value="PENDING">Pending</option><option value="RECEIVED">Received</option><option value="CANCELLED">Cancelled</option></select></div><div className="divide-y">{handovers.map((handover) => <article className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center" key={handover.id}><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700"><HandCoins size={18} /></span><div><p className="font-black text-[var(--color-text-strong)]">{handover.handoverCode}</p><p className="mt-1 text-sm text-[var(--color-muted)]">From {handover.fromUser?.fullName || "System"} to {handover.toUser?.fullName || "branch custodian"}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{dateTime(handover.createdAt)} · {handover.remarks || "No remarks"}</p></div></div><div><p className="font-black text-[var(--color-text-strong)]">{money(handover.amount)}</p><Status value={handover.status} /></div><div className="flex gap-2">{canReceive && handover.status === "PENDING" ? <button className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white" disabled={isSaving} onClick={() => actOnHandover(handover, "receive")} type="button"><CheckCircle2 size={14} />Receive</button> : null}{canManage && handover.status === "PENDING" ? <button className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700" disabled={isSaving} onClick={() => actOnHandover(handover, "cancel")} type="button"><XCircle size={14} />Cancel</button> : null}</div></article>)}{!isLoading && handovers.length === 0 ? <p className="p-8 text-center text-sm text-[var(--color-muted)]">No matching cash handovers.</p> : null}</div><div className="flex items-center justify-between border-t p-4"><p className="text-sm text-[var(--color-muted)]">Page {handoverMeta.page || handoverPage} of {handoverPages}</p><div className="flex gap-2"><button className="rounded-xl border p-2 disabled:opacity-30" disabled={handoverPage <= 1} onClick={() => setHandoverPage((page) => Math.max(1, page - 1))} type="button"><ChevronLeft size={18} /></button><button className="rounded-xl border p-2 disabled:opacity-30" disabled={handoverPage >= handoverPages} onClick={() => setHandoverPage((page) => page + 1)} type="button"><ChevronRight size={18} /></button></div></div></> : null}
      </section>

      {isLoading ? <div className="fixed bottom-5 right-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-text-strong)] px-4 py-2 text-xs font-bold text-white shadow-lg"><LoaderCircle className="animate-spin" size={14} />Loading cash ledger</div> : null}
    </div>
  )
}
