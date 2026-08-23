import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, CheckCircle2, CircleDollarSign, Clock3, RefreshCw } from "lucide-react"

import {
  approveIncentiveClaim,
  claimIncentiveCycle,
  getIncentiveCalendar,
  getIncentiveClaims,
  getIncentiveCycles,
  markIncentiveClaimPaid,
} from "./incentives.api"

const OWNER_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN"])
const CLASSIFICATION_LABELS = {
  NONE: "Not incentive eligible",
  SALES_AGENT: "Sales Agent",
  SENIOR_SALES_AGENT: "Senior Sales Agent",
  TECHNICIAN: "Technician",
  SENIOR_TECHNICIAN: "Senior Technician",
}

function money(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function dateLabel(value) {
  if (!value) return "—"
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
}

function apiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback
}

function phaseTone(status) {
  return {
    EARNING: "bg-sky-50 text-sky-700",
    CUT_OFF: "bg-amber-50 text-amber-800",
    CLAIMABLE: "bg-emerald-50 text-emerald-700",
    CLOSED: "bg-slate-100 text-slate-700",
  }[status] || "bg-slate-100 text-slate-700"
}

function claimTone(status) {
  return {
    CLAIMED: "bg-amber-50 text-amber-800",
    APPROVED: "bg-blue-50 text-blue-700",
    PAID: "bg-emerald-50 text-emerald-700",
    EXPIRED: "bg-slate-100 text-slate-700",
  }[status] || "bg-slate-100 text-slate-700"
}

function PeriodCard({ period, persisted = false }) {
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-[var(--color-text-strong)]">{dateLabel(period.startDate)} – {dateLabel(period.endDate)}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{period.periodCode || "Scheduled period"}</p>
        </div>
        {persisted ? <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${phaseTone(period.status)}`}>{period.status.replaceAll("_", " ")}</span> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div><p className="text-[var(--color-muted)]">Cutoff</p><p className="mt-1 font-bold">{dateLabel(period.cutoffDate)}</p></div>
        <div><p className="text-[var(--color-muted)]">Claim window</p><p className="mt-1 font-bold">{dateLabel(period.claimOpenDate)} – {dateLabel(period.claimCloseDate)}</p></div>
      </div>
    </article>
  )
}

export default function EnterpriseIncentiveMonitor({ selectedBranch, user }) {
  const isOwner = OWNER_ROLES.has(user?.role)
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""
  const [calendar, setCalendar] = useState(null)
  const [cycles, setCycles] = useState([])
  const [claims, setClaims] = useState([])
  const [classificationFilter, setClassificationFilter] = useState("")
  const [claimStatusFilter, setClaimStatusFilter] = useState("")
  const [cycleFilter, setCycleFilter] = useState("")
  const [staffFilter, setStaffFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const load = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")
    const params = { ...(branchId ? { branchId } : {}), limit: 30 }
    const claimParams = {
      ...params,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(classificationFilter ? { classification: classificationFilter } : {}),
      ...(claimStatusFilter ? { status: claimStatusFilter } : {}),
      ...(cycleFilter ? { cycleId: cycleFilter } : {}),
      ...(staffFilter ? { staffId: staffFilter } : {}),
    }
    try {
      const [calendarResponse, cyclesResponse, claimsResponse] = await Promise.all([
        getIncentiveCalendar(params),
        getIncentiveCycles(params),
        getIncentiveClaims(claimParams),
      ])
      setCalendar(calendarResponse?.data || null)
      setCycles(cyclesResponse?.data?.cycles || [])
      setClaims(claimsResponse?.data?.claims || [])
    } catch (error) {
      setCalendar(null)
      setCycles([])
      setClaims([])
      setErrorMessage(apiMessage(error, "Unable to load incentive cycles and claims."))
    } finally {
      setIsLoading(false)
    }
  }, [branchId, claimStatusFilter, classificationFilter, cycleFilter, dateFrom, dateTo, staffFilter])

  const cycleStaff = useMemo(() => {
    const byId = new Map()
    cycles.forEach((cycle) =>
      (cycle.employees || []).forEach((employee) => {
        if (employee.staff?.id) byId.set(employee.staff.id, employee.staff)
      }),
    )
    return [...byId.values()].sort((left, right) => left.fullName.localeCompare(right.fullName))
  }, [cycles])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const currentCycle = useMemo(
    () => cycles.find((cycle) => cycle.status === "EARNING") || null,
    [cycles],
  )
  const myCurrent = useMemo(
    () => currentCycle?.employees?.find((employee) => employee.staff?.id === user?.id) || null,
    [currentCycle, user?.id],
  )

  const perform = async (id, action) => {
    setBusyId(id)
    setMessage("")
    setErrorMessage("")
    try {
      if (action === "claim") await claimIncentiveCycle(id, {})
      if (action === "approve") await approveIncentiveClaim(id, {})
      if (action === "paid") await markIncentiveClaimPaid(id, { payoutReference: null })
      setMessage(
        action === "claim"
          ? "Claim submitted with an immutable transaction snapshot."
          : action === "approve"
            ? "Claim approved."
            : "Claim marked paid as monitoring metadata; no cash transaction was created.",
      )
      await load()
    } catch (error) {
      setErrorMessage(apiMessage(error, `Unable to ${action} this incentive.`))
    } finally {
      setBusyId("")
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-maroon)]">Calendar and claims</p>
            <h2 className="mt-2 text-xl font-black text-[var(--color-text-strong)]">Incentive cycles</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
              Cutoffs and claim windows are calculated by the server from immutable schedule versions.
            </p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-bold disabled:opacity-50" disabled={isLoading} onClick={load} type="button"><RefreshCw className={isLoading ? "animate-spin" : ""} size={16} /> Refresh cycles</button>
        </div>

        {message ? <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</div> : null}
        {errorMessage ? <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{errorMessage}</div> : null}

        {!isOwner && currentCycle ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-bold text-[var(--color-muted)]">Current period</p><p className="mt-2 font-black">{dateLabel(currentCycle.startDate)} – {dateLabel(currentCycle.endDate)}</p></div>
            <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-bold text-[var(--color-muted)]">Earned so far</p><p className="mt-2 text-xl font-black text-[var(--color-maroon)]">{money(myCurrent?.totalIncentive)}</p></div>
            <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-bold text-[var(--color-muted)]">Cutoff</p><p className="mt-2 font-black">{dateLabel(currentCycle.cutoffDate)}</p></div>
            <div className="rounded-2xl bg-[var(--color-soft)] p-4"><p className="text-xs font-bold text-[var(--color-muted)]">Claim window</p><p className="mt-2 font-black">{dateLabel(currentCycle.claimOpenDate)} – {dateLabel(currentCycle.claimCloseDate)}</p></div>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-soft)] p-5 shadow-card">
        <div className="flex items-center gap-3"><CalendarDays className="text-[var(--color-maroon)]" size={20} /><div><h3 className="font-black">Calendar</h3><p className="text-xs text-[var(--color-muted)]">Upcoming and persisted periods</p></div></div>
        {isLoading ? <p className="mt-5 text-sm font-bold text-[var(--color-muted)]">Loading calendar…</p> : null}
        {!isLoading && !(calendar?.persisted?.length || calendar?.upcoming?.length) ? <p className="mt-5 rounded-2xl bg-white p-4 text-sm font-semibold text-[var(--color-muted)]">No effective claim schedule has been configured yet.</p> : null}
        {calendar?.persisted?.length ? <><p className="mt-5 text-xs font-black uppercase tracking-wide text-[var(--color-muted)]">Persisted history</p><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{calendar.persisted.map((period) => <PeriodCard key={period.id} period={period} persisted />)}</div></> : null}
        {calendar?.upcoming?.length ? <><p className="mt-5 text-xs font-black uppercase tracking-wide text-[var(--color-muted)]">Schedule preview</p><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{calendar.upcoming.map((period) => <PeriodCard key={period.periodCode} period={period} />)}</div></> : null}
      </section>

      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
        <div className="flex items-center gap-3"><Clock3 className="text-[var(--color-maroon)]" size={20} /><div><h3 className="font-black">Employee cycle breakdown</h3><p className="text-xs text-[var(--color-muted)]">Product and service bases remain separate down to source transaction</p></div></div>
        <div className="mt-5 space-y-4">
          {cycles.flatMap((cycle) => (cycle.employees || []).map((employee) => (
            <article className="rounded-2xl border border-[var(--color-border)] p-4" key={`${cycle.id}-${employee.staff.id}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><p className="font-black">{employee.staff.fullName}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{CLASSIFICATION_LABELS[employee.classification] || (employee.mixedClassifications ? "Multiple snapshotted classifications" : "Legacy classification")} · {dateLabel(cycle.startDate)} – {dateLabel(cycle.endDate)}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${phaseTone(cycle.status)}`}>{cycle.status.replaceAll("_", " ")}</span><span className={`rounded-full px-2.5 py-1 text-xs font-black ${claimTone(employee.claimStatus)}`}>{employee.claimStatus.replaceAll("_", " ")}</span></div></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[var(--color-soft)] p-3"><p className="text-xs text-[var(--color-muted)]">Product</p><p className="mt-1 font-black">{money(employee.productIncentive)}</p><p className="text-xs">Basis {money(employee.productBasis)} · {employee.productRate === null ? "mixed rates" : `${Number(employee.productRate).toFixed(4)}%`}</p></div><div className="rounded-xl bg-[var(--color-soft)] p-3"><p className="text-xs text-[var(--color-muted)]">Service</p><p className="mt-1 font-black">{money(employee.serviceIncentive)}</p><p className="text-xs">Basis {money(employee.serviceBasis)} · {employee.serviceRate === null ? "mixed rates" : `${Number(employee.serviceRate).toFixed(4)}%`}</p></div><div className="rounded-xl bg-[var(--color-maroon-soft)] p-3"><p className="text-xs text-[var(--color-muted)]">Cycle incentive</p><p className="mt-1 text-lg font-black text-[var(--color-maroon)]">{money(employee.totalIncentive)}</p></div></div>
              <details className="mt-4 rounded-xl border border-[var(--color-border)] p-3"><summary className="cursor-pointer text-sm font-black">{employee.sources.length} transaction source(s)</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="text-[var(--color-muted)]"><tr><th className="py-2">Source</th><th>Date</th><th>Type</th><th className="text-right">Basis</th><th className="text-right">Rate</th><th className="text-right">Incentive</th></tr></thead><tbody>{employee.sources.map((source) => <tr className="border-t border-[var(--color-border)]" key={source.id}><td className="py-2 font-bold">{source.sourceCode}</td><td>{dateLabel(source.sourceDate)}</td><td>{source.sourceType.replaceAll("_", " ")}</td><td className="text-right">{money(source.basisAmount)}</td><td className="text-right">{Number(source.ratePercent).toFixed(4)}%</td><td className="text-right font-black">{money(source.amount)}</td></tr>)}</tbody></table></div></details>
              {!isOwner && cycle.status === "CLAIMABLE" && !employee.claim && employee.sources.length > 0 ? <button className="mt-4 rounded-xl bg-[var(--color-maroon)] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" disabled={busyId === cycle.id} onClick={() => perform(cycle.id, "claim")} type="button">{busyId === cycle.id ? "Submitting…" : "Claim this cycle"}</button> : null}
            </article>
          )))}
          {!isLoading && cycles.every((cycle) => !(cycle.employees || []).length) ? <p className="rounded-2xl bg-[var(--color-soft)] p-5 text-sm font-semibold text-[var(--color-muted)]">No attributed incentive activity exists in persisted cycles yet.</p> : null}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
        <div className="flex items-center gap-3"><CircleDollarSign className="text-[var(--color-maroon)]" size={20} /><div><h3 className="font-black">Claims monitoring</h3><p className="text-xs text-[var(--color-muted)]">Paid is status metadata only and never posts a cash transaction</p></div></div>
        {isOwner ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <select className="rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm" onChange={(event) => setCycleFilter(event.target.value)} value={cycleFilter}>
              <option value="">All periods</option>
              {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{dateLabel(cycle.startDate)} – {dateLabel(cycle.endDate)}</option>)}
            </select>
            <select className="rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm" onChange={(event) => setClassificationFilter(event.target.value)} value={classificationFilter}>
              <option value="">All classifications</option>
              {Object.entries(CLASSIFICATION_LABELS).filter(([value]) => value !== "NONE").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm" onChange={(event) => setStaffFilter(event.target.value)} value={staffFilter}>
              <option value="">All eligible staff</option>
              {cycleStaff.map((staffMember) => <option key={staffMember.id} value={staffMember.id}>{staffMember.fullName}</option>)}
            </select>
            <select className="rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm" onChange={(event) => setClaimStatusFilter(event.target.value)} value={claimStatusFilter}>
              <option value="">All claim statuses</option>
              {["CLAIMED", "APPROVED", "PAID", "EXPIRED"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <input aria-label="Claim period from" className="rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm" onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
            <input aria-label="Claim period to" className="rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm" onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
          </div>
        ) : null}
        <div className="mt-5 grid gap-3">
          {claims.map((claim) => <article className="rounded-2xl border border-[var(--color-border)] p-4" key={claim.id}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-black">{claim.staff?.fullName || "Employee"} · {claim.cycle?.periodCode}</p><p className="mt-1 text-xs text-[var(--color-muted)]">{claim.lines?.length || 0} frozen transaction line(s) · {money(claim.totalIncentive)}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${claimTone(claim.status)}`}>{claim.status}</span></div>{isOwner && claim.status === "CLAIMED" ? <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" disabled={busyId === claim.id} onClick={() => perform(claim.id, "approve")} type="button"><CheckCircle2 size={16} /> Approve</button> : null}{isOwner && claim.status === "APPROVED" ? <button className="mt-4 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" disabled={busyId === claim.id} onClick={() => perform(claim.id, "paid")} type="button">Mark paid</button> : null}</article>)}
          {!isLoading && !claims.length ? <p className="rounded-2xl bg-[var(--color-soft)] p-5 text-sm font-semibold text-[var(--color-muted)]">No submitted incentive claims yet.</p> : null}
        </div>
      </section>
    </div>
  )
}
