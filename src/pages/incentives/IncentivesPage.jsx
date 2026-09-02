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
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-[var(--color-maroon)] border border-rose-100">
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-0.5 font-mono text-xl font-black text-slate-900">{value}</p>
          {note ? <p className="mt-0.5 text-[11px] text-slate-400">{note}</p> : null}
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
    if (!enterprise.isReady) return "Enterprise config pending"
    return enabled.length ? enabled.join(" / ") : "All posting disabled"
  }, [enterprise.isReady, rules])

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">Finance</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Incentives</h1>
            <p className="mt-0.5 max-w-3xl text-xs text-slate-500">
              {isOwnerView
                ? "Monitor settings-driven product and service incentives with direct source attribution."
                : "Review incentives credited to your own completed work."}
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            disabled={isLoading}
            onClick={loadIncentives}
            type="button"
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} size={14} /> Refresh
          </button>
        </div>
      </section>

      <EnterpriseIncentiveMonitor selectedBranch={selectedBranch} user={user} />

      {message ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{message}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={BadgePercent} label="Posted incentive" value={money(totals.totalAmount)} note={`${totals.postedEntries || 0} payable source(s)`} />
        <SummaryCard icon={UserRound} label="Product incentive" value={money(totals.itemAmount)} note="Completed product sales" />
        <SummaryCard icon={ShieldCheck} label="Service incentive" value={money(totals.serviceAmount)} note="Quotation and service work" />
        <SummaryCard icon={CalendarDays} label="Eligible basis" value={money(totals.totalBasis)} note={enabledSummary} />
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/75 p-3.5 text-xs font-semibold leading-5 text-amber-900">
        <p>{enterprise.disclosure || "Incentives follow the current saved business rules."}</p>
        {disclosure ? <p className="mt-0.5 text-slate-600">{disclosure}</p> : null}
      </section>

      <section className={`grid gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs ${isOwnerView ? "md:grid-cols-2 xl:grid-cols-5" : "md:grid-cols-2 xl:grid-cols-4"}`}>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
          onChange={(event) => { setType(event.target.value); setPage(1) }}
          value={type}
        >
          {TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
          onChange={(event) => { setStatus(event.target.value); setPage(1) }}
          value={status}
        >
          <option value="POSTED">Posted only</option>
          <option value="REVERSED">Reversed only</option>
          <option value="">All ledger statuses</option>
        </select>
        {isOwnerView ? (
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--color-maroon)]"
            onChange={(event) => { setStaffId(event.target.value); setPage(1) }}
            value={staffId}
          >
            <option value="">All eligible staff</option>
            {staff.map((person) => <option key={person.id} value={person.id}>{person.fullName} ({person.role === "CASHIER" ? "Sales Agent" : String(person.role).replaceAll("_", " ")})</option>)}
          </select>
        ) : null}
        <input aria-label="Date from" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} type="date" value={dateFrom} />
        <input aria-label="Date to" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setDateTo(event.target.value); setPage(1) }} type="date" value={dateTo} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-xs font-bold text-slate-400"><LoaderCircle className="animate-spin" size={16} /> Loading incentives…</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center"><BadgePercent className="mx-auto text-slate-300" size={32} /><p className="mt-2 text-xs font-bold text-slate-700">No matching incentive entries</p><p className="mt-0.5 text-[11px] text-slate-400">{enterprise.isReady ? "Completed, eligible sources will appear here when their source type is enabled." : "New posting is paused until an effective rate matrix and claim schedule are both saved."}</p></div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600"><tr><th className="px-4 py-3">Source</th><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Basis</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Incentive</th></tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {entries.map((entry) => (
                    <tr className={`hover:bg-slate-50/50 transition ${entry.status === "REVERSED" ? "bg-rose-50/40" : ""}`} key={entry.id}>
                      <td className="px-4 py-3"><p className="font-mono font-bold text-slate-900">{entry.sourceCode || entry.sourceId}</p><p className="text-[11px] text-slate-400">{typeLabel(entry.sourceType)} / {entry.attribution}</p>{entry.reversalReason ? <p className="text-[10px] font-bold text-rose-600">{entry.reversalReason}</p> : null}</td>
                      <td className="px-4 py-3"><p className="font-bold text-slate-800">{entry.staff?.fullName || "Unassigned"}</p><p className="text-[11px] text-slate-400">{classificationLabel(entry.classification)}</p></td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{entry.branch?.code || entry.branch?.name || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{dateOnly(entry.sourceDate)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${entry.status === "REVERSED" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>{entry.status}</span></td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">{money(entry.basisAmount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{Number(entry.percent || 0).toFixed(2)}%</td>
                      <td className={`px-4 py-3 text-right font-mono font-black ${entry.status === "REVERSED" ? "text-rose-600 line-through" : "text-[var(--color-maroon)]"}`}>{money(entry.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2.5 p-3 lg:hidden">
              {entries.map((entry) => (
                <article className={`rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs ${entry.status === "REVERSED" ? "border-rose-200 bg-rose-50/40" : ""}`} key={entry.id}>
                  <div className="flex items-start justify-between gap-2"><div><p className="font-mono font-bold text-slate-900">{entry.sourceCode || entry.sourceId}</p><p className="text-[11px] text-slate-400">{typeLabel(entry.sourceType)} / {entry.status}</p></div><p className={`font-mono font-black ${entry.status === "REVERSED" ? "text-rose-600 line-through" : "text-[var(--color-maroon)]"}`}>{money(entry.amount)}</p></div>
                  {entry.reversalReason ? <p className="mt-1 text-[10px] font-bold text-rose-600">{entry.reversalReason}</p> : null}
                  <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 text-xs"><div><p className="text-[10px] font-bold uppercase text-slate-400">Credited to</p><p className="font-bold text-slate-800">{entry.staff?.fullName || "Unassigned"}</p><p className="text-[10px] text-slate-400">{classificationLabel(entry.classification)}</p></div><div><p className="text-[10px] font-bold uppercase text-slate-400">Basis / rate</p><p className="font-mono font-bold text-slate-800">{money(entry.basisAmount)} / {Number(entry.percent || 0).toFixed(2)}%</p></div><div><p className="text-[10px] font-bold uppercase text-slate-400">Branch</p><p className="font-semibold text-slate-700">{entry.branch?.code || "-"}</p></div><div><p className="text-[10px] font-bold uppercase text-slate-400">Source date</p><p className="text-slate-600">{dateOnly(entry.sourceDate)}</p></div></div>
                </article>
              ))}
            </div>
          </>
        )}
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50/75 p-3 text-xs text-slate-500"><p>Page {meta.page || page} of {totalPages} / {meta.total || 0} entry(s)</p><div className="flex gap-1.5"><button className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><ChevronLeft size={16} /></button><button className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-30" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} type="button"><ChevronRight size={16} /></button></div></footer>
      </section>
    </div>
  )
}
