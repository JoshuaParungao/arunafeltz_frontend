import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Layers,
  Laptop,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Wrench,
  X,
  Zap,
} from "lucide-react"

import { USER_ROLES } from "../../constants/roles"
import {
  createServiceCatalogItem,
  deleteServiceCatalogItem,
  getServiceCatalog,
  updateServiceCatalogItem,
} from "../../features/service-jobs/serviceJobs.api"

const CAN_MANAGE_ROLES = new Set([
  USER_ROLES.SUPER_OWNER,
  USER_ROLES.BRANCH_OWNER,
  USER_ROLES.ADMIN,
])

const DEVICE_TYPE_PRESETS = [
  "Laptop",
  "Desktop",
  "MacBook",
  "Printer",
  "Monitor",
  "Smartphone / Tablet",
  "Console",
  "General / All Units",
]

const EMPTY_FORM = {
  name: "",
  deviceType: "Laptop",
  repairType: "ORDINARY_REPAIR",
  basePrice: "",
  markupPercent: "0",
  description: "",
  isQuickService: false,
  isActive: true,
}

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)

export default function ServicesMaintenancePage({ user }) {
  const [catalogItems, setCatalogItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [filterDeviceType, setFilterDeviceType] = useState("ALL")
  const [filterRepairType, setFilterRepairType] = useState("ALL")
  const [activeOnly, setActiveOnly] = useState(false)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [deletingId, setDeletingId] = useState(null)

  const canManage = user?.role ? CAN_MANAGE_ROLES.has(user.role) : false

  const fetchCatalog = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const response = await getServiceCatalog()
      const data = response?.data || response || []
      setCatalogItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Failed to load service catalog:", err)
      setError(err?.response?.data?.message || "Failed to load service catalog rates.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCatalog()
  }, [fetchCatalog])

  const openCreateModal = () => {
    setEditingItem(null)
    setFormData(EMPTY_FORM)
    setError("")
    setIsModalOpen(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setFormData({
      name: item.name || "",
      deviceType: item.deviceType || "Laptop",
      repairType: item.repairType || "ORDINARY_REPAIR",
      basePrice: item.basePrice != null ? String(item.basePrice) : "0",
      markupPercent: item.markupPercent != null ? String(item.markupPercent) : "0",
      description: item.description || "",
      isQuickService: Boolean(item.isQuickService),
      isActive: item.isActive !== false,
    })
    setError("")
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingItem(null)
    setFormData(EMPTY_FORM)
    setError("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError("Service Name is required.")
      return
    }
    if (!formData.deviceType.trim()) {
      setError("Unit / Device Type is required.")
      return
    }

    const basePriceNum = Number(formData.basePrice) || 0
    if (basePriceNum < 0) {
      setError("Base Price cannot be negative.")
      return
    }

    setIsSaving(true)
    setError("")
    try {
      const payload = {
        name: formData.name.trim(),
        deviceType: formData.deviceType.trim(),
        repairType: formData.repairType,
        basePrice: basePriceNum,
        markupPercent: Number(formData.markupPercent) || 0,
        description: formData.description.trim(),
        isQuickService: formData.isQuickService,
        isActive: formData.isActive,
      }

      if (editingItem) {
        await updateServiceCatalogItem(editingItem.id, payload)
        setSuccessMessage(`Updated "${payload.name}" successfully.`)
      } else {
        await createServiceCatalogItem(payload)
        setSuccessMessage(`Created "${payload.name}" service template.`)
      }

      closeModal()
      await fetchCatalog()
      setTimeout(() => setSuccessMessage(""), 4000)
    } catch (err) {
      console.error("Save service catalog error:", err)
      setError(err?.response?.data?.message || "Failed to save service rate.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete service rate "${item.name}"?`)) {
      return
    }

    setDeletingId(item.id)
    try {
      await deleteServiceCatalogItem(item.id)
      setSuccessMessage(`Deleted "${item.name}".`)
      await fetchCatalog()
      setTimeout(() => setSuccessMessage(""), 4000)
    } catch (err) {
      console.error("Delete service catalog error:", err)
      setError(err?.response?.data?.message || "Failed to delete service rate.")
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleActive = async (item) => {
    try {
      await updateServiceCatalogItem(item.id, { isActive: !item.isActive })
      await fetchCatalog()
    } catch (err) {
      console.error("Toggle active error:", err)
      setError(err?.response?.data?.message || "Failed to update status.")
    }
  }

  // Filtered Items
  const filteredItems = useMemo(() => {
    return catalogItems.filter((item) => {
      if (activeOnly && !item.isActive) return false
      if (filterRepairType !== "ALL" && item.repairType !== filterRepairType) return false
      if (
        filterDeviceType !== "ALL" &&
        !item.deviceType.toLowerCase().includes(filterDeviceType.toLowerCase())
      ) {
        return false
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchName = item.name?.toLowerCase().includes(query)
        const matchDevice = item.deviceType?.toLowerCase().includes(query)
        const matchDesc = item.description?.toLowerCase().includes(query)
        if (!matchName && !matchDevice && !matchDesc) return false
      }

      return true
    })
  }, [catalogItems, searchQuery, filterDeviceType, filterRepairType, activeOnly])

  // Statistics
  const stats = useMemo(() => {
    const total = catalogItems.length
    const ordinary = catalogItems.filter((i) => i.repairType === "ORDINARY_REPAIR").length
    const boardLevel = catalogItems.filter((i) => i.repairType === "BOARD_LEVEL_REPAIR").length
    const active = catalogItems.filter((i) => i.isActive).length
    return { total, ordinary, boardLevel, active }
  }, [catalogItems])

  // Computed preview for modal
  const modalBase = Number(formData.basePrice) || 0
  const modalMarkup = Number(formData.markupPercent) || 0
  const modalFinal = modalBase + modalBase * (modalMarkup / 100)

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[var(--color-maroon)]/10 p-2 text-[var(--color-maroon)]">
              <Layers size={22} />
            </span>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                Services &amp; Repair Rates
              </h1>
              <p className="text-xs text-slate-500">
                Service catalog masterlist, standard labor rates, and repair classifications.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition"
            disabled={isLoading}
            onClick={fetchCatalog}
            type="button"
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} size={14} /> Refresh
          </button>
          {canManage ? (
            <button
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-black text-white shadow-xs hover:opacity-90 transition"
              onClick={openCreateModal}
              type="button"
            >
              <Plus size={16} /> Add Service Rate
            </button>
          ) : null}
        </div>
      </div>

      {/* Notifications */}
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      {successMessage ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-700">
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      ) : null}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-800 p-4 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Services</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Predefined catalog rates</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-800 p-4 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Standard / Ordinary</p>
          <p className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">{stats.ordinary}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Basic cleaning, format, screens</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-800 p-4 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Board Level</p>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{stats.boardLevel}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Micro-soldering &amp; IC repair</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-800 p-4 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Rates</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.active}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Available for Job Orders</p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-800 p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-maroon)]/20"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search service name, unit type, or scope..."
              type="text"
              value={searchQuery}
            />
            {searchQuery ? (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setSearchQuery("")}
                type="button"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {/* Unit / Device Type Filter */}
          <select
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
            onChange={(e) => setFilterDeviceType(e.target.value)}
            value={filterDeviceType}
          >
            <option value="ALL">All Device Types</option>
            {DEVICE_TYPE_PRESETS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {/* Repair Type Filter */}
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5">
            {[
              { key: "ALL", label: "All Types" },
              { key: "ORDINARY_REPAIR", label: "Standard" },
              { key: "BOARD_LEVEL_REPAIR", label: "Board Level" },
            ].map((tab) => (
              <button
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  filterRepairType === tab.key
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                key={tab.key}
                onClick={() => setFilterRepairType(tab.key)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active Only */}
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              checked={activeOnly}
              className="rounded border-slate-300 text-[var(--color-maroon)] focus:ring-[var(--color-maroon)]"
              onChange={(e) => setActiveOnly(e.target.checked)}
              type="checkbox"
            />
            <span>Active only</span>
          </label>
        </div>
      </div>

      {/* Catalog Cards Grid */}
      {isLoading ? (
        <div className="grid min-h-64 place-items-center">
          <LoaderCircle className="animate-spin text-[var(--color-maroon)]" size={32} />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
          <Wrench className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={40} />
          <h3 className="text-base font-black text-slate-800 dark:text-white">
            No service rates found
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search criteria or add a new service rate template.
          </p>
          {canManage ? (
            <button
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-xs font-black text-white"
              onClick={openCreateModal}
              type="button"
            >
              <Plus size={15} /> Add Service Rate
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const isBoard = item.repairType === "BOARD_LEVEL_REPAIR"
            const finalComputedPrice =
              (Number(item.basePrice) || 0) +
              (Number(item.basePrice) || 0) * ((Number(item.markupPercent) || 0) / 100)

            return (
              <div
                className={`rounded-2xl border transition p-4.5 flex flex-col justify-between gap-3 group ${
                  item.isActive
                    ? "border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[var(--color-maroon)]/40 hover:shadow-md"
                    : "border-slate-200/50 bg-slate-50/50 dark:bg-slate-900/50 opacity-60"
                }`}
                key={item.id}
              >
                <div className="space-y-3">
                  {/* Card Top Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {item.deviceType || "General"}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                          isBoard
                            ? "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300"
                            : "bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300"
                        }`}
                      >
                        {isBoard ? "🔬 Board Level" : "🔧 Standard"}
                      </span>
                      {item.isQuickService ? (
                        <span className="rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:text-amber-300">
                          ⚡ Quick
                        </span>
                      ) : null}
                    </div>

                    <button
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold cursor-pointer transition ${
                        item.isActive
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                      }`}
                      disabled={!canManage}
                      onClick={() => handleToggleActive(item)}
                      title="Click to toggle active status"
                      type="button"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.isActive ? "bg-emerald-600" : "bg-slate-400"
                        }`}
                      />
                      {item.isActive ? "Active" : "Inactive"}
                    </button>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white group-hover:text-[var(--color-maroon)] transition-colors">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {item.description || "No specific scope notes provided."}
                    </p>
                  </div>
                </div>

                {/* Price Summary & Card Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Standard Rate
                    </p>
                    <p className="font-mono font-black text-base text-[var(--color-maroon)] dark:text-amber-400">
                      {money(finalComputedPrice)}
                    </p>
                    {item.markupPercent > 0 ? (
                      <p className="text-[10px] text-slate-400 font-mono">
                        Base {money(item.basePrice)} (+{item.markupPercent}%)
                      </p>
                    ) : null}
                  </div>

                  {canManage ? (
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        onClick={() => openEditModal(item)}
                        title="Edit rate"
                        type="button"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 transition"
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item)}
                        title="Delete rate"
                        type="button"
                      >
                        {deletingId === item.id ? (
                          <LoaderCircle className="animate-spin" size={14} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Service Modal */}
      {isModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
          <section
            aria-modal="true"
            className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
            role="dialog"
          >
            <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-slate-50/75 dark:bg-slate-800/75 px-5 py-3.5">
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                {editingItem ? "Edit Service Rate" : "Add New Service Rate"}
              </h2>
              <button
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                onClick={closeModal}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={handleSubmit}>
              <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5 sm:p-6 text-xs">
                {error ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                    <AlertCircle size={15} />
                    <span>{error}</span>
                  </div>
                ) : null}

                {/* Service Name */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Service Name / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-maroon)]/20"
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Laptop Deep Cleaning & Thermal Repaste"
                    required
                    type="text"
                    value={formData.name}
                  />
                </div>

                {/* Device / Unit Type */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Unit / Device Category <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-maroon)]/20"
                    onChange={(e) => setFormData((f) => ({ ...f, deviceType: e.target.value }))}
                    placeholder="e.g. Laptop, MacBook, Desktop, Printer..."
                    required
                    type="text"
                    value={formData.deviceType}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {DEVICE_TYPE_PRESETS.map((preset) => (
                      <button
                        className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
                        key={preset}
                        onClick={() => setFormData((f) => ({ ...f, deviceType: preset }))}
                        type="button"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Repair Classification */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    Repair Classification (Incentive Linking) <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      className={`flex flex-col text-left p-3 rounded-xl border transition ${
                        formData.repairType === "ORDINARY_REPAIR"
                          ? "border-[var(--color-maroon)] bg-[var(--color-maroon)]/5 ring-2 ring-[var(--color-maroon)]/20"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      }`}
                      onClick={() =>
                        setFormData((f) => ({ ...f, repairType: "ORDINARY_REPAIR" }))
                      }
                      type="button"
                    >
                      <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                        <Wrench size={14} className="text-sky-600" />
                        <span>Standard Repair</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Eligible for all active branch technicians.
                      </p>
                    </button>

                    <button
                      className={`flex flex-col text-left p-3 rounded-xl border transition ${
                        formData.repairType === "BOARD_LEVEL_REPAIR"
                          ? "border-purple-600 bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-600/20"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      }`}
                      onClick={() =>
                        setFormData((f) => ({ ...f, repairType: "BOARD_LEVEL_REPAIR" }))
                      }
                      type="button"
                    >
                      <div className="flex items-center gap-1.5 font-black text-purple-700 dark:text-purple-300">
                        <Sparkles size={14} className="text-purple-600" />
                        <span>Board Level Repair</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Requires Senior Technician classification.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Pricing Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Standard Base Price (₱) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-maroon)]/20"
                      min="0"
                      onChange={(e) => setFormData((f) => ({ ...f, basePrice: e.target.value }))}
                      placeholder="0.00"
                      required
                      step="0.01"
                      type="number"
                      value={formData.basePrice}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Default Markup (%)
                    </label>
                    <input
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-maroon)]/20"
                      min="0"
                      onChange={(e) => setFormData((f) => ({ ...f, markupPercent: e.target.value }))}
                      placeholder="0"
                      step="0.01"
                      type="number"
                      value={formData.markupPercent}
                    />
                  </div>
                </div>

                {/* Final Computed Preview */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 flex items-center justify-between">
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    Final Standard Charge:
                  </span>
                  <span className="font-mono font-black text-sm text-[var(--color-maroon)] dark:text-amber-400">
                    {money(modalFinal)}
                  </span>
                </div>

                {/* Description / Scope */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Standard Scope / Inclusions
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-maroon)]/20"
                    maxLength="2000"
                    onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Standard work checklist, notes, or inclusions..."
                    rows="3"
                    value={formData.description}
                  />
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      checked={formData.isQuickService}
                      className="rounded text-[var(--color-maroon)] focus:ring-[var(--color-maroon)]"
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, isQuickService: e.target.checked }))
                      }
                      type="checkbox"
                    />
                    <span>⚡ Quick / Express Service Template</span>
                  </label>

                  <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      checked={formData.isActive}
                      className="rounded text-[var(--color-maroon)] focus:ring-[var(--color-maroon)]"
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, isActive: e.target.checked }))
                      }
                      type="checkbox"
                    />
                    <span>Active in Catalog</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-4">
                <button
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition"
                  onClick={closeModal}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-black text-white shadow-xs hover:opacity-90 transition disabled:opacity-50"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? (
                    <LoaderCircle className="animate-spin" size={14} />
                  ) : (
                    <Check size={14} />
                  )}
                  {isSaving ? "Saving..." : editingItem ? "Update Rate" : "Save Service Rate"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
