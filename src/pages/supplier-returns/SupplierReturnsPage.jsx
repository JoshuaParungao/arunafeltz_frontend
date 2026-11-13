import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  PackageX,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Truck,
  Undo2,
  Wrench,
} from "lucide-react"
import { getSupplierReturns } from "../../features/supplier-returns/supplierReturns.api"
import { getSuppliers } from "../../features/suppliers/suppliers.api"
import NewSupplierReturnModal from "../../components/supplier-returns/NewSupplierReturnModal"
import SupplierReturnDetailModal from "../../components/supplier-returns/SupplierReturnDetailModal"
import DispatchReturnModal from "../../components/supplier-returns/DispatchReturnModal"
import ResolveReturnModal from "../../components/supplier-returns/ResolveReturnModal"
import SupplierReturnSlipModal from "../../components/supplier-returns/SupplierReturnSlipModal"

function formatDate(dateValue) {
  if (!dateValue) return "—"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return String(dateValue)
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatCurrency(val) {
  return `₱${Number(val || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function SupplierReturnsPage({ selectedBranch, user }) {
  const branchId = selectedBranch?.id || user?.branchId || user?.branch?.id

  const [activeTab, setActiveTab] = useState("ALL") // 'ALL' | 'PENDING' | 'OUT_TO_SUPPLIER' | 'RESOLVED'
  const [search, setSearch] = useState("")
  const [supplierId, setSupplierId] = useState("")
  const [suppliers, setSuppliers] = useState([])

  const [returns, setReturns] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 })
  const [summary, setSummary] = useState({
    pendingPullOut: 0,
    withSupplier: 0,
    resolved: 0,
    totalCostValue: 0,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [inspectReturn, setInspectReturn] = useState(null)
  const [dispatchReturnTarget, setDispatchReturnTarget] = useState(null)
  const [resolveReturnTarget, setResolveReturnTarget] = useState(null)
  const [slipPrintTarget, setSlipPrintTarget] = useState(null)

  // Load suppliers for filter
  useEffect(() => {
    getSuppliers({ limit: 100, status: "ACTIVE" })
      .then((res) => {
        const list = res?.data || res || []
        setSuppliers(Array.isArray(list) ? list : [])
      })
      .catch((err) => console.error("Error loading suppliers:", err))
  }, [])

  const fetchReturns = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const params = {
        branchId,
        page: pagination.page,
        limit: pagination.limit,
      }

      if (search.trim()) params.search = search.trim()
      if (supplierId) params.supplierId = supplierId

      if (activeTab === "PENDING") {
        params.status = "DRAFT" // or filter in client if needed
      } else if (activeTab === "OUT_TO_SUPPLIER") {
        params.status = "OUT_TO_SUPPLIER"
      } else if (activeTab === "RESOLVED") {
        params.status = "RESOLVED"
      }

      const res = await getSupplierReturns(params)
      setReturns(res?.data || [])
      if (res?.meta?.pagination) setPagination(res.meta.pagination)
      if (res?.meta?.summary) setSummary(res.meta.summary)
    } catch (err) {
      console.error("Load supplier returns error:", err)
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to load supplier returns."
      )
    } finally {
      setIsLoading(false)
    }
  }, [branchId, pagination.page, pagination.limit, search, supplierId, activeTab])

  useEffect(() => {
    fetchReturns()
  }, [fetchReturns])

  const handleCreated = (newReturn) => {
    fetchReturns()
    setInspectReturn(newReturn)
  }

  const handleDispatched = (updated) => {
    fetchReturns()
    setInspectReturn(updated)
  }

  const handleResolved = (updated) => {
    fetchReturns()
    setInspectReturn(updated)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Supplier Returns (Bad Order / RMA)
            </h1>
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
              B.O. Monitoring
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Monitor and pull out defective store items, sales returns, and customer warranty claims to suppliers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchReturns}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-800 to-rose-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-900/10 hover:from-rose-900 hover:to-rose-800 transition"
          >
            <Plus className="size-4" />
            New Supplier Return (B.O.)
          </button>
        </div>
      </div>

      {/* QUICK STATS CARDS */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* PENDING PULL-OUT */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Pull-Out</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {summary.pendingPullOut}
            </span>
            <span className="text-xs text-slate-400">batches draft/approved</span>
          </div>
        </div>

        {/* WITH SUPPLIER (IN-TRANSIT) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">With Supplier</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Truck className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {summary.withSupplier}
            </span>
            <span className="text-xs text-slate-400">under RMA review</span>
          </div>
        </div>

        {/* RESOLVED */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Resolved RMA</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {summary.resolved}
            </span>
            <span className="text-xs text-slate-400">settled cases</span>
          </div>
        </div>

        {/* TOTAL VALUE */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total B.O. Value</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
              <Boxes className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-slate-900">
              {formatCurrency(summary.totalCostValue)}
            </span>
          </div>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        {/* TABS */}
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`rounded-lg px-3 py-1.5 transition ${
              activeTab === "ALL"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Returns
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("PENDING")}
            className={`rounded-lg px-3 py-1.5 transition ${
              activeTab === "PENDING"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Pending Pull-Out
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("OUT_TO_SUPPLIER")}
            className={`rounded-lg px-3 py-1.5 transition ${
              activeTab === "OUT_TO_SUPPLIER"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            With Supplier ({summary.withSupplier})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("RESOLVED")}
            className={`rounded-lg px-3 py-1.5 transition ${
              activeTab === "RESOLVED"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Resolved ({summary.resolved})
          </button>
        </div>

        {/* SEARCH & SUPPLIER DROPDOWN */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search return #, serial, RMA..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 rounded-xl border border-slate-200 py-1.5 pl-8 pr-3 text-xs focus:border-rose-500 focus:outline-none"
            />
          </div>

          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-700 focus:border-rose-500 focus:outline-none"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Return Code</th>
              <th className="px-4 py-3">Date & Supplier</th>
              <th className="px-4 py-3">Source Origin</th>
              <th className="px-4 py-3">Items & Value</th>
              <th className="px-4 py-3">Logistics / Courier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">RMA Outcome</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {returns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  <PackageX className="mx-auto size-8 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">No Supplier Returns found</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Click &quot;+ New Supplier Return&quot; above to create a pull-out order.
                  </p>
                </td>
              </tr>
            ) : (
              returns.map((ret) => {
                const isResolved = ret.status === "RESOLVED"
                const isOut = ret.status === "OUT_TO_SUPPLIER"
                const isDraft = ret.status === "DRAFT" || ret.status === "APPROVED"

                return (
                  <tr key={ret.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      <button
                        type="button"
                        onClick={() => setInspectReturn(ret)}
                        className="text-rose-700 hover:underline"
                      >
                        {ret.returnCode}
                      </button>
                      {ret.supplierRmaNumber && (
                        <div className="font-mono text-[10px] text-indigo-600">
                          RMA: {ret.supplierRmaNumber}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{ret.supplier?.name}</div>
                      <div className="text-[11px] text-slate-400">{formatDate(ret.createdAt)}</div>
                    </td>

                    <td className="px-4 py-3">
                      {ret.sourceType === "CUSTOMER_WARRANTY" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                          <ShieldAlert className="size-3" />
                          Customer Claim
                        </span>
                      ) : ret.sourceType === "CUSTOMER_RETURN" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                          <RotateCcw className="size-3" />
                          Sales Return
                        </span>
                      ) : ret.sourceType === "MIXED" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                          Mixed Sources
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                          <Boxes className="size-3" />
                          Store B.O.
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{ret.totalItems} unit(s)</div>
                      <div className="font-mono font-bold text-slate-600 text-[11px]">
                        {formatCurrency(ret.subtotalCost)}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      <div className="font-semibold">{ret.driverName || "Direct Handover"}</div>
                      <div className="text-[11px] text-slate-400">
                        {ret.courierName || "—"} {ret.vehiclePlate ? `(${ret.vehiclePlate})` : ""}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          ret.status === "RESOLVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : ret.status === "OUT_TO_SUPPLIER"
                            ? "bg-blue-100 text-blue-800"
                            : ret.status === "APPROVED"
                            ? "bg-purple-100 text-purple-800"
                            : ret.status === "CANCELLED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {ret.status === "OUT_TO_SUPPLIER" ? "WITH SUPPLIER" : ret.status}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {ret.resolutionType && ret.resolutionType !== "PENDING" ? (
                        <div>
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                              ret.resolutionType === "REPLACEMENT"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : ret.resolutionType === "REPAIRED"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : ret.resolutionType === "RETURN_TO_CUSTOMER_DEFECTIVE"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : ret.resolutionType === "CREDIT_MEMO"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-slate-50 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {ret.resolutionType === "RETURN_TO_CUSTOMER_DEFECTIVE"
                              ? "Return Defective (CID)"
                              : ret.resolutionType}
                          </span>
                          {ret.creditMemoNumber && (
                            <div className="text-[10px] text-purple-800 font-mono mt-0.5">
                              #{ret.creditMemoNumber}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* VIEW */}
                        <button
                          type="button"
                          onClick={() => setInspectReturn(ret)}
                          title="View Details"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                        >
                          <Eye className="size-4" />
                        </button>

                        {/* PRINT SLIP */}
                        <button
                          type="button"
                          onClick={() => setSlipPrintTarget(ret)}
                          title="Print A4 Pull-Out Slip"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                        >
                          <Printer className="size-4" />
                        </button>

                        {/* DISPATCH (IF PENDING) */}
                        {isDraft && (
                          <button
                            type="button"
                            onClick={() => setDispatchReturnTarget(ret)}
                            className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
                          >
                            <Truck className="size-3" /> Dispatch
                          </button>
                        )}

                        {/* RESOLVE (IF WITH SUPPLIER) */}
                        {isOut && (
                          <button
                            type="button"
                            onClick={() => setResolveReturnTarget(ret)}
                            className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition"
                          >
                            <CheckCircle2 className="size-3" /> Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* PAGINATION */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
            <div>
              Showing {returns.length} of {pagination.total} records
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 font-bold text-slate-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      <NewSupplierReturnModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreated={handleCreated}
        branchId={branchId}
      />

      <SupplierReturnDetailModal
        returnData={inspectReturn}
        isOpen={Boolean(inspectReturn)}
        onClose={() => setInspectReturn(null)}
        onPrint={(ret) => setSlipPrintTarget(ret)}
        onOpenDispatch={(ret) => setDispatchReturnTarget(ret)}
        onOpenResolve={(ret) => setResolveReturnTarget(ret)}
        onUpdated={(updated) => {
          fetchReturns()
          setInspectReturn(updated)
        }}
      />

      <DispatchReturnModal
        returnData={dispatchReturnTarget}
        isOpen={Boolean(dispatchReturnTarget)}
        onClose={() => setDispatchReturnTarget(null)}
        onDispatched={handleDispatched}
      />

      <ResolveReturnModal
        returnData={resolveReturnTarget}
        isOpen={Boolean(resolveReturnTarget)}
        onClose={() => setResolveReturnTarget(null)}
        onResolved={handleResolved}
      />

      <SupplierReturnSlipModal
        returnData={slipPrintTarget}
        isOpen={Boolean(slipPrintTarget)}
        onClose={() => setSlipPrintTarget(null)}
      />
    </div>
  )
}

