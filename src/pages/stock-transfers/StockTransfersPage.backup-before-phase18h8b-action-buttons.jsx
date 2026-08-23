import { useEffect, useState } from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { getStockTransfers, updateStockTransferStatusById } from "../../features/stock-transfers/stockTransfers.api"

function formatDate(value) {
  if (!value) return "—"

  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function StatusBadge({ status }) {
  const styles = {
    REQUESTED: "bg-amber-50 text-amber-700",
    APPROVED: "bg-blue-50 text-blue-700",
    REJECTED: "bg-rose-50 text-rose-700",
    POSTED: "bg-emerald-50 text-emerald-700",
    CANCELLED: "bg-gray-100 text-gray-600",
    DRAFT: "bg-gray-100 text-gray-600",
  }

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${styles[status] || styles.DRAFT}`}>
      {status || "UNKNOWN"}
    </span>
  )
}

export default function StockTransfersPage() {
  const [transfers, setTransfers] = useState([])
  const [statusFilter, setStatusFilter] = useState("REQUESTED")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [actionTransferId, setActionTransferId] = useState("")

  const loadTransfers = async () => {
    setIsLoading(true)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await getStockTransfers({
        status: statusFilter || undefined,
        limit: 20,
      })

      setTransfers(response?.data?.items || [])
    } catch (error) {
      setErrorMessage(error?.response?.data?.error?.message || "Could not load stock transfers.")
    } finally {
      setIsLoading(false)
    }
  }

  const updateTransferStatus = async (transfer, nextStatus) => {
    const payload = {
      status: nextStatus,
    }

    if (nextStatus === "REJECTED") {
      const reason = window.prompt("Reason for rejecting this request")

      if (!reason || !reason.trim()) {
        setErrorMessage("Rejection reason is required.")
        return
      }

      payload.rejectionReason = reason.trim()
    }

    setActionTransferId(transfer.id)
    setErrorMessage("")
    setSuccessMessage("")

    try {
      const response = await updateStockTransferStatusById(transfer.id, payload)
      setSuccessMessage(`${response?.data?.transferCode || transfer.transferCode} is now ${nextStatus.toLowerCase()}.`)
      await loadTransfers()
    } catch (error) {
      setErrorMessage(error?.response?.data?.error?.message || "Could not update stock transfer.")
    } finally {
      setActionTransferId("")
    }
  }

  useEffect(() => {
    loadTransfers()
  }, [statusFilter])

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#7A1F2B]">
              Supply / Stock
            </p>
            <h1 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">
              Stock Transfers
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-[var(--color-muted)]">
              Review requests between branches. Approval does not move stock yet.
            </p>
          </div>

          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-black text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
            onClick={loadTransfers}
            type="button"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="text-sm font-black text-[var(--color-text-strong)]">
            Status
          </label>

          <select
            className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none focus:border-[#7A1F2B] md:max-w-xs"
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option value="REQUESTED">Requested</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="POSTED">Posted</option>
            <option value="">All</option>
          </select>
        </div>

        {errorMessage ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--color-border)]">
          <div className="table-wrapper">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3">Transfer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Requested by</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Requested at</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--color-border)] bg-white">
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-8 text-center font-bold text-[var(--color-muted)]" colSpan={7}>
                      Loading stock transfers...
                    </td>
                  </tr>
                ) : null}

                {!isLoading && transfers.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center font-bold text-[var(--color-muted)]" colSpan={7}>
                      No stock transfers found.
                    </td>
                  </tr>
                ) : null}

                {!isLoading
                  ? transfers.map((transfer) => (
                      <tr key={transfer.id} className="align-top">
                        <td className="px-4 py-4">
                          <p className="font-black text-[var(--color-text-strong)]">
                            {transfer.transferCode}
                          </p>
                          <p className="mt-1 text-xs font-bold text-[var(--color-muted)]">
                            {transfer.notes || "No notes"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={transfer.status} />
                        </td>
                        <td className="px-4 py-4 font-bold text-[var(--color-text-strong)]">
                          {transfer.fromBranch?.code || "—"}
                        </td>
                        <td className="px-4 py-4 font-bold text-[var(--color-text-strong)]">
                          {transfer.toBranch?.code || "—"}
                        </td>
                        <td className="px-4 py-4 font-bold text-[var(--color-text-strong)]">
                          {transfer.requestedBy?.username || "—"}
                        </td>
                        <td className="px-4 py-4 font-bold text-[var(--color-text-strong)]">
                          {transfer.items?.length || 0}
                        </td>
                        <td className="px-4 py-4 font-bold text-[var(--color-muted)]">
                          {formatDate(transfer.requestedAt)}
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}




