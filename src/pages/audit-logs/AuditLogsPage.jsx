import { useCallback, useEffect, useState } from "react"

import { getAuditLogById, getAuditLogs } from "../../features/audit-logs/auditLogs.api"

function isoBoundary(value, end = false) {
  if (!value) return undefined
  return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}`).toISOString()
}

function dateTime(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-PH")
}

export default function AuditLogsPage({ selectedBranch, user }) {
  const [logs, setLogs] = useState([])
  const [meta, setMeta] = useState({})
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [action, setAction] = useState("")
  const [entityType, setEntityType] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedLog, setSelectedLog] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id || ""

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const response = await getAuditLogs({
        ...(branchId ? { branchId } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(action.trim() ? { action: action.trim() } : {}),
        ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
        ...(dateFrom ? { dateFrom: isoBoundary(dateFrom) } : {}),
        ...(dateTo ? { dateTo: isoBoundary(dateTo, true) } : {}),
        page,
        limit: 25,
      })

      setLogs(Array.isArray(response?.data) ? response.data : [])
      setMeta(response?.meta || {})
    } catch (error) {
      setLogs([])
      setMeta({})
      setErrorMessage(error?.response?.data?.message || error?.response?.data?.error?.message || "Could not load audit logs.")
    } finally {
      setIsLoading(false)
    }
  }, [action, branchId, dateFrom, dateTo, entityType, page, search])

  useEffect(() => {
    const timer = window.setTimeout(loadLogs, 200)
    return () => window.clearTimeout(timer)
  }, [loadLogs])

  const openLog = async (log) => {
    setSelectedLog(log)
    try {
      const response = await getAuditLogById(log.id)
      setSelectedLog(response?.data || log)
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Could not load audit log details.")
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-6 shadow-card">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-maroon)]">Monitoring</p>
        <h1 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">Audit logs</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Immutable operational history with safe actor, entity, branch, and metadata visibility.</p>
      </section>

      <section className="grid gap-3 rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card md:grid-cols-2 xl:grid-cols-6">
        <input aria-label="Search audit logs" className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)] xl:col-span-2" onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search description, action, entity, actor" value={search} />
        <input aria-label="Filter by exact action" className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setAction(event.target.value); setPage(1) }} placeholder="Exact action" value={action} />
        <input aria-label="Filter by exact entity type" className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setEntityType(event.target.value); setPage(1) }} placeholder="Exact entity type" value={entityType} />
        <input aria-label="Audit date from" className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} type="date" value={dateFrom} />
        <input aria-label="Audit date to" className="rounded-2xl border px-4 py-3 text-sm outline-none focus:border-[var(--color-maroon)]" onChange={(event) => { setDateTo(event.target.value); setPage(1) }} type="date" value={dateTo} />
      </section>

      {errorMessage ? <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{errorMessage}</div> : null}

      <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">
              <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Details</th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td className="px-4 py-8 text-center text-[var(--color-muted)]" colSpan={7}>Loading audit logs...</td></tr> : null}
              {!isLoading && logs.length === 0 ? <tr><td className="px-4 py-8 text-center text-[var(--color-muted)]" colSpan={7}>No audit records match the filters.</td></tr> : null}
              {!isLoading ? logs.map((log) => (
                <tr className="border-t border-[var(--color-border)] align-top" key={log.id}>
                  <td className="px-4 py-4 whitespace-nowrap">{dateTime(log.createdAt)}</td>
                  <td className="px-4 py-4 font-bold">{log.actor?.fullName || "System"}<span className="block text-xs font-normal text-[var(--color-muted)]">{log.actor?.role || "SYSTEM"}</span></td>
                  <td className="px-4 py-4 font-bold text-[var(--color-maroon)]">{log.action}</td>
                  <td className="px-4 py-4">{log.entityType}<span className="block max-w-40 truncate text-xs text-[var(--color-muted)]">{log.entityId || "—"}</span></td>
                  <td className="px-4 py-4">{log.branch?.code || "Global"}</td>
                  <td className="px-4 py-4 max-w-sm">{log.description || "—"}</td>
                  <td className="px-4 py-4"><button className="rounded-xl border px-3 py-2 text-xs font-bold" onClick={() => openLog(log)} type="button">View</button></td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t p-4">
          <button className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Previous</button>
          <span className="text-sm text-[var(--color-muted)]">Page {meta.page || page} of {meta.totalPages || 1} • {meta.total || 0} records</span>
          <button className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={page >= Number(meta.totalPages || 1)} onClick={() => setPage((value) => value + 1)} type="button">Next</button>
        </div>
      </section>

      {selectedLog ? (
        <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[var(--color-maroon)]">Audit detail</p><h2 className="mt-1 font-black text-[var(--color-text-strong)]">{selectedLog.action}</h2></div><button className="rounded-xl border px-3 py-2 text-xs font-bold" onClick={() => setSelectedLog(null)} type="button">Close</button></div>
          <dl className="mt-4 grid gap-3 md:grid-cols-3"><div><dt className="text-xs font-bold text-[var(--color-muted)]">Actor</dt><dd className="mt-1 font-semibold">{selectedLog.actor?.fullName || "System"}</dd></div><div><dt className="text-xs font-bold text-[var(--color-muted)]">Branch</dt><dd className="mt-1 font-semibold">{selectedLog.branch?.name || "Global"}</dd></div><div><dt className="text-xs font-bold text-[var(--color-muted)]">Timestamp</dt><dd className="mt-1 font-semibold">{dateTime(selectedLog.createdAt)}</dd></div></dl>
          <pre className="mt-4 max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(selectedLog.metadata || {}, null, 2)}</pre>
        </section>
      ) : null}
    </div>
  )
}
