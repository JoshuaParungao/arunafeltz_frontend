import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BadgePercent,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { getIncentives } from "../../features/incentives/incentives.api"
import { getUsers } from "../../features/users/users.api"
import EnterpriseIncentiveMonitor from "../../features/incentives/EnterpriseIncentiveMonitor"

const OWNER_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN"])
const TYPES = [
  { value: "", label: "All incentive types" },
  { value: "SALE_ITEM", label: "Product sale" },
  { value: "QUOTATION_SERVICE", label: "Quotation service" },
  { value: "SERVICE_JOB", label: "Service job" },
]

function money(value) {
  return `\u20B1${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function dateOnly(value) {
  if (!value) return "-"
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("en-PH")
}

function apiError(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback
}

function typeLabel(value) {
  return TYPES.find((option) => option.value === value)?.label || String(value || "-").replaceAll("_", " ")
}

function classificationLabel(value) {
  return value ? String(value).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Legacy entry"
}

function SummaryCard({ icon: Icon, label, value, note }) {
  return (
    <article className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon-soft)] text-[var(--color-maroon)]">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-muted)]">{label}</p>
          <p className="mt-1 text-2xl font-black text-[var(--color-text-strong)]">{value}</p>
          {note ? <p className="mt-1 text-xs text-[var(--color-muted)]">{note}</p> : null}
        </div>
      </div>
    </article>
  )
}

export default function IncentivesPage({ selectedBranch, user }) {
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""
  const isOwnerView = OWNER_ROLES.has(user?.role)
  const [entries, setEntries] = useState([])
  const [totals, setTotals] = useState({})
  const [rules, setRules] = useState({})
  const [enterprise, setEnterprise] = useState({})
  const [meta, setMeta] = useState({})
  const [disclosure, setDisclosure] = useState("")
  const [staff, setStaff] = useState([])
  const [type, setType] = useState("")
  const [status, setStatus] = useState("POSTED")
  const [staffId, setStaffId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("")

  const loadIncentives = useCallback(async () => {
    setIsLoading(true)
    setMessage("")
    try {
      const response = await getIncentives({
        ...(branchId ? { branchId } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(isOwnerView && staffId ? { staffId } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        page,
        limit: 20,
      })
      const result = response?.data || {}
      setEntries(Array.isArray(result.entries) ? result.entries : [])
      setTotals(result.totals || {})
      setRules(result.rules || {})
      setEnterprise(result.enterprise || {})
      setMeta(result.meta || {})
      setDisclosure(result.disclosure || "")
    } catch (error) {
      setEntries([])
      setTotals({})
      setEnterprise({})
      setMeta({})
      setMessage(apiError(error, "Could not load incentives."))
    } finally {
      setIsLoading(false)
    }
  }, [branchId, dateFrom, dateTo, isOwnerView, page, staffId, status, type])

  useEffect(() => {
    const timer = window.setTimeout(loadIncentives, 0)
    return () => window.clearTimeout(timer)
  }, [loadIncentives])

  useEffect(() => {
    if (!isOwnerView) return undefined
    let active = true
    const loadStaff = async () => {
      try {
        const response = await getUsers({
          ...(branchId ? { branchId } : {}),
          status: "ACTIVE",
          page: 1,
          limit: 100,
        })
        if (active) setStaff(Array.isArray(response?.data) ? response.data : [])
      } catch {
        if (active) setStaff([])
      }
    }
    loadStaff()
    return () => {
      active = false
    }
  }, [branchId, isOwnerView])

  const totalPages = Math.max(1, Number(meta.totalPages || 1))
  const enabledSummary = useMemo(() => {
    const enabled = []
    if (rules.enableItemIncentives) enabled.push("Product enabled")
    if (rules.enableServiceIncentives) enabled.push("Service enabled")
    if (!enterprise.isReady) return "Enterprise configuration pending"
    return enabled.length ? enabled.join(" / ") : "All incentive posting disabled"
  }, [enterprise.isReady, rules])

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-maroon)]">Finance</p>
            <h1 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">Incentives</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
              {isOwnerView
                ? "Monitor settings-driven product and service incentives with direct source attribution."
                : "Review incentives credited to your own completed work."}
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold disabled:opacity-50"
            disabled={isLoading}
            onClick={loadIncentives}
            type="button"
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} size={16} /> Refresh
          </button>
        </div>
      </section>

      <EnterpriseIncentiveMonitor selectedBranch={selectedBranch} user={user} />

      {message ? <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{message}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={BadgePercent} label="Posted incentive" value={money(totals.totalAmount)} note={`${totals.postedEntries || 0} payable source(s)`} />
        <SummaryCard icon={UserRound} label="Product incentive" value={money(totals.itemAmount)} note="Completed product sales" />
        <SummaryCard icon={ShieldCheck} label="Service incentive" value={money(totals.serviceAmount)} note="Quotation and service work" />
        <SummaryCard icon={CalendarDays} label="Eligible basis" value={money(totals.totalBasis)} note={enabledSummary} />
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
        <p>{enterprise.disclosure || "Incentives follow the current saved business rules."}</p>
        {disclosure ? <p className="mt-1">{disclosure}</p> : null}
      </section>

      <section className={`grid gap-3 rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card ${isOwnerView ? "md:grid-cols-2 xl:grid-cols-5" : "md:grid-cols-2 xl:grid-cols-4"}`}>
        <select
          className="rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm"
          onChange={(event) => { setType(event.target.value); setPage(1) }}
          value={type}
        >
          {TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select
          className="rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm"
          onChange={(event) => { setStatus(event.target.value); setPage(1) }}
          value={status}
        >
          <option value="POSTED">Posted only</option>
          <option value="REVERSED">Reversed only</option>
          <option value="">All ledger statuses</option>
        </select>
        {isOwnerView ? (
          <select
            className="rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm"
            onChange={(event) => { setStaffId(event.target.value); setPage(1) }}
            value={staffId}
          >
            <option value="">All eligible staff</option>
            {staff.map((person) => <option key={person.id} value={person.id}>{person.fullName} ({person.role === "CASHIER" ? "Sales Agent" : String(person.role).replaceAll("_", " ")})</option>)}
          </select>
        ) : null}
        <input aria-label="Date from" className="rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm" onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} type="date" value={dateFrom} />
        <input aria-label="Date to" className="rounded-xl border border-[var(--color-border)] px-3 py-3 text-sm" onChange={(event) => { setDateTo(event.target.value); setPage(1) }} type="date" value={dateTo} />
      </section>

      <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm font-bold text-[var(--color-muted)]"><LoaderCircle className="animate-spin" size={18} /> Loading incentives...</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center"><BadgePercent className="mx-auto text-[var(--color-muted)]" size={40} /><p className="mt-3 font-black">No matching incentive entries</p><p className="mt-1 text-sm text-[var(--color-muted)]">{enterprise.isReady ? "Completed, eligible sources will appear here when their source type is enabled." : "New posting is paused until an effective rate matrix and claim schedule are both saved."}</p></div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-[var(--color-soft)] text-xs uppercase text-[var(--color-muted)]"><tr><th className="px-4 py-3">Source</th><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Basis</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Incentive</th></tr></thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {entries.map((entry) => (
                    <tr className={entry.status === "REVERSED" ? "bg-rose-50/50" : ""} key={entry.id}><td className="px-4 py-4"><p className="font-black">{entry.sourceCode || entry.sourceId}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{typeLabel(entry.sourceType)} / {entry.attribution}</p>{entry.reversalReason ? <p className="mt-1 text-xs font-semibold text-rose-700">{entry.reversalReason}</p> : null}</td><td className="px-4 py-4"><p className="font-bold">{entry.staff?.fullName || "Unassigned"}</p><p className="text-xs text-[var(--color-muted)]">{classificationLabel(entry.classification)}</p></td><td className="px-4 py-4">{entry.branch?.code || entry.branch?.name || "-"}</td><td className="px-4 py-4">{dateOnly(entry.sourceDate)}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${entry.status === "REVERSED" ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{entry.status}</span></td><td className="px-4 py-4 text-right font-semibold">{money(entry.basisAmount)}</td><td className="px-4 py-4 text-right">{Number(entry.percent || 0).toFixed(2)}%</td><td className={`px-4 py-4 text-right font-black ${entry.status === "REVERSED" ? "text-rose-700 line-through" : "text-[var(--color-maroon)]"}`}>{money(entry.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-4 lg:hidden">
              {entries.map((entry) => (
                <article className="rounded-2xl border border-[var(--color-border)] p-4" key={entry.id}>
                  <div className="flex items-start justify-between gap-3"><div><p className="font-black">{entry.sourceCode || entry.sourceId}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{typeLabel(entry.sourceType)} / {entry.status}</p></div><p className={`font-black ${entry.status === "REVERSED" ? "text-rose-700 line-through" : "text-[var(--color-maroon)]"}`}>{money(entry.amount)}</p></div>
                  {entry.reversalReason ? <p className="mt-2 text-xs font-semibold text-rose-700">{entry.reversalReason}</p> : null}
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-[var(--color-muted)]">Credited to</p><p className="font-bold">{entry.staff?.fullName || "Unassigned"}</p><p className="text-xs text-[var(--color-muted)]">{classificationLabel(entry.classification)}</p></div><div><p className="text-xs text-[var(--color-muted)]">Basis / rate</p><p className="font-bold">{money(entry.basisAmount)} / {Number(entry.percent || 0).toFixed(2)}%</p></div><div><p className="text-xs text-[var(--color-muted)]">Branch</p><p className="font-bold">{entry.branch?.code || "-"}</p></div><div><p className="text-xs text-[var(--color-muted)]">Source date</p><p className="font-bold">{dateOnly(entry.sourceDate)}</p></div></div>
                </article>
              ))}
            </div>
          </>
        )}
        <footer className="flex items-center justify-between border-t border-[var(--color-border)] p-4"><p className="text-sm text-[var(--color-muted)]">Page {meta.page || page} of {totalPages} / {meta.total || 0} entry(s)</p><div className="flex gap-2"><button className="rounded-xl border p-2 disabled:opacity-30" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><ChevronLeft size={18} /></button><button className="rounded-xl border p-2 disabled:opacity-30" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={18} /></button></div></footer>
      </section>
    </div>
  )
}
