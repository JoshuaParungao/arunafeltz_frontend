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

const ROLE_LABELS = {
  SUPER_OWNER: "Main Admin",
  BRANCH_OWNER: "Branch Owner",
  ADMIN: "Store Admin",
  CASHIER: "Cashier",
  TECHNICIAN: "Technician",
  CASH_CUSTODIAN: "Cash Custodian",
  SYSTEM: "System Automated",
}

function formatRole(role) {
  if (!role) return "System"
  if (ROLE_LABELS[role]) return ROLE_LABELS[role]
  return String(role)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatAction(action) {
  if (!action) return "Activity"
  return String(action)
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function formatEntityType(entity) {
  if (!entity) return "—"
  const entityMap = {
    Database: "Database Backup",
    StockTransfer: "Stock Transfer",
    ServiceJob: "Job Order",
    Sale: "Sale Transaction",
    BusinessSetting: "Settings",
    InventoryMovement: "Stock Movement",
    ItemSerial: "Serialized Unit",
    User: "User Account",
    Branch: "Branch Profile",
    Customer: "Customer Profile",
    Supplier: "Supplier Profile",
    PurchaseOrder: "Purchase Order",
    PurchaseReceiving: "Delivery Receiving",
    CashBox: "Cash Box",
    CashTransaction: "Cash Entry",
    Incentive: "Incentive Record",
  }
  if (entityMap[entity]) return entityMap[entity]
  return String(entity)
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
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
      setErrorMessage(
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        "Could not load audit logs."
      )
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
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-card">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-maroon)]">
          Monitoring
        </p>
        <h1 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">Audit logs</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Activity history with safe performer, entity, branch, and event trail.
        </p>
      </section>

      <section className="grid gap-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-card md:grid-cols-2 xl:grid-cols-6">
        <input
          aria-label="Search audit logs"
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)] xl:col-span-2"
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Search activity, description, user, or module"
          value={search}
        />
        <input
          aria-label="Filter by activity"
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
          onChange={(event) => {
            setAction(event.target.value)
            setPage(1)
          }}
          placeholder="Filter activity"
          value={action}
        />
        <input
          aria-label="Filter by module / entity"
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
          onChange={(event) => {
            setEntityType(event.target.value)
            setPage(1)
          }}
          placeholder="Filter module"
          value={entityType}
        />
        <input
          aria-label="Audit date from"
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
          onChange={(event) => {
            setDateFrom(event.target.value)
            setPage(1)
          }}
          type="date"
          value={dateFrom}
        />
        <input
          aria-label="Audit date to"
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm text-[var(--color-text-strong)] outline-none focus:border-[var(--color-maroon)]"
          onChange={(event) => {
            setDateTo(event.target.value)
            setPage(1)
          }}
          type="date"
          value={dateTo}
        />
      </section>

      {errorMessage ? (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-sm font-bold text-rose-700 dark:text-rose-300">
          {errorMessage}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-[0.12em] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Performer</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Module / Record</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-[var(--color-muted)]" colSpan={7}>
                    Loading audit logs...
                  </td>
                </tr>
              ) : null}
              {!isLoading && logs.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-[var(--color-muted)]" colSpan={7}>
                    No activity records match the filters.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? logs.map((log) => (
                  <tr className="align-top hover:bg-[var(--color-soft)]/50 transition" key={log.id}>
                    <td className="px-4 py-4 whitespace-nowrap text-xs font-semibold text-[var(--color-muted)]">
                      {dateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold text-[var(--color-text-strong)] block">
                        {log.actor?.fullName || log.actor?.username || "System"}
                      </span>
                      <span className="block text-xs font-medium text-[var(--color-muted)]">
                        {formatRole(log.actor?.role)}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-bold text-[var(--color-maroon)]">
                      {formatAction(log.action)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-semibold text-[var(--color-text-strong)] block">
                        {formatEntityType(log.entityType)}
                      </span>
                      <span className="block max-w-40 truncate text-xs text-[var(--color-muted)]">
                        {log.entityId || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs font-semibold text-[var(--color-text-strong)]">
                      {log.branch?.name || log.branch?.code || "Global / System"}
                    </td>
                    <td className="px-4 py-4 max-w-sm text-xs leading-relaxed text-[var(--color-text)]">
                      {log.description || "—"}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
                        onClick={() => openLog(log)}
                        type="button"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
                : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--color-border)] p-4">
          <button
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            type="button"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-[var(--color-muted)]">
            Page {meta.page || page} of {meta.totalPages || 1} • {meta.total || 0} records
          </span>
          <button
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={page >= Number(meta.totalPages || 1)}
            onClick={() => setPage((value) => value + 1)}
            type="button"
          >
            Next
          </button>
        </div>
      </section>

      {selectedLog ? (
        <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-[var(--color-maroon)]">Audit Detail</p>
              <h2 className="mt-1 font-black text-[var(--color-text-strong)]">
                {formatAction(selectedLog.action)}
              </h2>
            </div>
            <button
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
              onClick={() => setSelectedLog(null)}
              type="button"
            >
              Close
            </button>
          </div>
          <dl className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3.5">
              <dt className="text-xs font-bold text-[var(--color-muted)]">Performer</dt>
              <dd className="mt-1 font-bold text-[var(--color-text-strong)]">
                {selectedLog.actor?.fullName || selectedLog.actor?.username || "System"} ({formatRole(selectedLog.actor?.role)})
              </dd>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3.5">
              <dt className="text-xs font-bold text-[var(--color-muted)]">Branch</dt>
              <dd className="mt-1 font-bold text-[var(--color-text-strong)]">
                {selectedLog.branch?.name || selectedLog.branch?.code || "Global / System"}
              </dd>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3.5">
              <dt className="text-xs font-bold text-[var(--color-muted)]">Date & Time</dt>
              <dd className="mt-1 font-bold text-[var(--color-text-strong)]">
                {dateTime(selectedLog.createdAt)}
              </dd>
            </div>
          </dl>
          <pre className="mt-4 max-h-96 overflow-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-xs font-mono text-[var(--color-text-strong)]">
            {JSON.stringify(selectedLog.metadata || {}, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  )
}
