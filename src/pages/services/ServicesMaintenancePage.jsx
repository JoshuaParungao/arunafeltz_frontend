import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Check,
  Clock,
  Edit3,
  Eye,
  Layers,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
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
  createServicePartsCatalogItem,
  deleteServiceCatalogItem,
  deleteServicePartsCatalogItem,
  getServiceCatalog,
  getServicePartsCatalog,
  updateServiceCatalogItem,
  updateServicePartsCatalogItem,
} from "../../features/service-jobs/serviceJobs.api"

const OWNER_ROLES = new Set([
  USER_ROLES.SUPER_OWNER,
  USER_ROLES.BRANCH_OWNER,
  USER_ROLES.ADMIN,
])

const DEVICE_TYPE_PRESETS = [
  "LAPTOP",
  "DESKTOP",
  "GPU",
  "MOTHERBOARD",
  "MACBOOK",
  "PRINTER",
  "MONITOR",
  "SMARTPHONE / TABLET",
  "CONSOLE",
  "PC COMPONENT",
  "OTHER",
]

const PART_CATEGORY_PRESETS = [
  "SCREEN",
  "BATTERY",
  "KEYBOARD",
  "FAN",
  "IC CHIP",
  "PORT",
  "CONSUMABLE",
  "OTHER",
]

function normalizeCategoryName(cat) {
  return (cat || "").trim().toUpperCase().replace(/\s+/g, " ")
}

const EMPTY_SERVICE_FORM = {
  name: "",
  deviceType: "LAPTOP",
  repairType: "ORDINARY_REPAIR",
  basePrice: "0",
  markupPercent: "0",
  description: "",
  isQuickService: false,
  status: "ACTIVE",
}

const EMPTY_PART_FORM = {
  name: "",
  deviceType: "LAPTOP",
  category: "SCREEN",
  costPrice: "0",
  markupAmount: "0",
  description: "",
  status: "ACTIVE",
}

function formatMoney(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount)
}

function StatusPill({ status }) {
  const isActive = status === "ACTIVE" || status === true

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${
        isActive
          ? "bg-emerald-50/80 text-emerald-700 border border-emerald-200/50"
          : "bg-slate-100/80 text-slate-500 border border-slate-200/50"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
      {isActive ? "ACTIVE" : "INACTIVE"}
    </span>
  )
}

function ServiceDetailModal({ item, onClose }) {
  if (!item) return null

  const isBoard = item.repairType === "BOARD_LEVEL_REPAIR"
  const basePrice = Number(item.basePrice || 0)
  const markup = Number(item.markupPercent || 0)
  const finalPrice = basePrice + basePrice * (markup / 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200/80 flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">{item.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {item.deviceType || "General"} · {isBoard ? "Board Level Repair" : "Standard Repair"}
            </p>
          </div>
          <button
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Classification</span>
              <p className="mt-0.5 font-semibold text-slate-800">
                {isBoard ? "Board Level Repair" : "Standard Repair"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Service Mode</span>
              <p className="mt-0.5 font-semibold text-slate-800">
                {item.isQuickService ? "Quick / Same-Day" : "Standard Queue"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Pricing Details</span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Base Charge</span>
                <span className="mt-0.5 font-mono font-semibold text-slate-800 block">{formatMoney(basePrice)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Markup</span>
                <span className="mt-0.5 font-mono font-semibold text-slate-800 block">{markup}%</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--color-maroon-soft)]/20 border border-[var(--color-border)]">
                <span className="text-[10px] text-[var(--color-maroon)] font-semibold block">Customer Rate</span>
                <span className="mt-0.5 font-mono font-bold text-sm text-[var(--color-maroon)] block">{formatMoney(finalPrice)}</span>
              </div>
            </div>
          </div>

          {item.description ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Scope of Work</span>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{item.description}</p>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-3.5 bg-slate-50/30">
          <button
            className="rounded-xl px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function ServiceEditorModal({
  errorMessage,
  form,
  isEditing,
  isSaving,
  onChange,
  onClose,
  onSave,
}) {
  if (!form) return null

  const basePriceNum = Number(form.basePrice || 0)
  const markupPercentNum = Number(form.markupPercent || 0)
  const finalPriceNum = basePriceNum + basePriceNum * (markupPercentNum / 100)

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave()
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:bg-white focus:ring-1 focus:ring-[var(--color-maroon)]/20 placeholder:text-slate-400"
  const labelClass = "text-[11px] font-semibold text-slate-600 block tracking-wide"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <form
        className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200/80 flex flex-col"
        onSubmit={handleSubmit}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {isEditing ? "Edit Service Rate" : "New Service Rate"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Standard repair pricing, classification, and device type.
            </p>
          </div>
          <button
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </header>

        {errorMessage ? (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/60 p-3 text-xs text-red-700 font-medium">
            <AlertCircle className="shrink-0" size={14} />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <div className="p-6 space-y-4 overflow-y-auto">
          <label className="block">
            <span className={labelClass}>Service Name *</span>
            <input
              className={inputClass}
              maxLength="120"
              onChange={(event) => onChange("name", event.target.value)}
              placeholder="e.g. Laptop Deep Cleaning & Thermal Repaste"
              required
              value={form.name}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Device Category *</span>
              <select
                className={inputClass}
                onChange={(event) => onChange("deviceType", event.target.value)}
                value={form.deviceType}
              >
                {DEVICE_TYPE_PRESETS.map((device) => (
                  <option key={device} value={device}>
                    {device}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Status</span>
              <select
                className={inputClass}
                onChange={(event) => onChange("status", event.target.value)}
                value={form.status}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
          </div>

          <div>
            <span className={labelClass}>Classification</span>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              <button
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  form.repairType === "ORDINARY_REPAIR"
                    ? "border-[var(--color-maroon)] bg-[var(--color-maroon-soft)]/20 ring-1 ring-[var(--color-maroon)]/30"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
                onClick={() => onChange("repairType", "ORDINARY_REPAIR")}
                type="button"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <Wrench size={13} className="text-[var(--color-maroon)]" />
                  <span>Standard Repair</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Cleaning, OS installation, storage/RAM</p>
              </button>

              <button
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  form.repairType === "BOARD_LEVEL_REPAIR"
                    ? "border-[var(--color-maroon)] bg-[var(--color-maroon-soft)]/20 ring-1 ring-[var(--color-maroon)]/30"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
                onClick={() => onChange("repairType", "BOARD_LEVEL_REPAIR")}
                type="button"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <Sparkles size={13} className="text-[var(--color-maroon)]" />
                  <span>Board Level</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Micro-soldering, tracing, IC chips</p>
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Base Charge (₱) *</span>
              <input
                className={`${inputClass} font-mono`}
                min="0"
                onChange={(event) => onChange("basePrice", event.target.value)}
                placeholder="0.00"
                required
                step="0.01"
                type="number"
                value={form.basePrice}
              />
            </label>

            <label className="block">
              <span className={labelClass}>Default Markup (%)</span>
              <input
                className={`${inputClass} font-mono`}
                min="0"
                onChange={(event) => onChange("markupPercent", event.target.value)}
                placeholder="0"
                step="0.01"
                type="number"
                value={form.markupPercent}
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Customer Final Rate:</span>
            <span className="font-mono font-bold text-sm text-[var(--color-maroon)]">
              {formatMoney(finalPriceNum)}
            </span>
          </div>

          <label className="block">
            <span className={labelClass}>Description / Notes</span>
            <textarea
              className={`${inputClass} resize-none`}
              maxLength="2000"
              onChange={(event) => onChange("description", event.target.value)}
              placeholder="Scope of work, standard inclusions..."
              rows="2"
              value={form.description}
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
            <input
              checked={form.isQuickService}
              className="rounded text-[var(--color-maroon)] focus:ring-[var(--color-maroon)]"
              onChange={(event) => onChange("isQuickService", event.target.checked)}
              type="checkbox"
            />
            <span className="font-medium">Quick / Express Same-Day Service</span>
          </label>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3.5 bg-slate-50/30">
          <button
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-semibold text-white hover:bg-[var(--color-maroon-hover)] transition shadow-2xs disabled:opacity-50 cursor-pointer"
            disabled={isSaving}
            type="submit"
          >
            <Save size={13} />
            {isSaving ? "Saving…" : isEditing ? "Save Changes" : "Create Rate"}
          </button>
        </footer>
      </form>
    </div>
  )
}

function PartDetailModal({ item, onClose }) {
  if (!item) return null

  const cost = Number(item.costPrice || 0)
  const markup = Number(item.markupAmount || 0)
  const suggestedSrp = cost + markup

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200/80 flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">{item.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {item.deviceType || "General"} · {(item.category || "OTHER").replace(/_/g, " ")}
            </p>
          </div>
          <button
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Device</span>
              <p className="mt-0.5 font-semibold text-slate-800 truncate">{item.deviceType || "All"}</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Category</span>
              <p className="mt-0.5 font-semibold text-slate-800 truncate font-mono">{(item.category || "OTHER").replace(/_/g, " ")}</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</span>
              <div className="mt-1">
                <StatusPill status={item.isActive !== false ? "ACTIVE" : "INACTIVE"} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Economics</span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Part Cost</span>
                <span className="mt-0.5 font-mono font-semibold text-slate-800 block">{formatMoney(cost)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Shop Markup</span>
                <span className="mt-0.5 font-mono font-semibold text-slate-800 block">+{formatMoney(markup)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--color-maroon-soft)]/20 border border-[var(--color-border)]">
                <span className="text-[10px] text-[var(--color-maroon)] font-semibold block">Suggested SRP</span>
                <span className="mt-0.5 font-mono font-bold text-sm text-[var(--color-maroon)] block">{formatMoney(suggestedSrp)}</span>
              </div>
            </div>
          </div>

          {item.description ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Specifications</span>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{item.description}</p>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-3.5 bg-slate-50/30">
          <button
            className="rounded-xl px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function ManagePartCategoriesModal({
  categories = [],
  onClose,
  onDeleteCategory,
  onRenameCategory,
  partsItems = [],
}) {
  const [editingCat, setEditingCat] = useState(null)
  const [renameValue, setRenameValue] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories
    const q = searchTerm.trim().toLowerCase()
    return categories.filter((cat) => cat.toLowerCase().includes(q))
  }, [categories, searchTerm])

  const getUsageCount = (cat) => {
    const cleanCat = normalizeCategoryName(cat)
    const altCat = cleanCat.replace(/\s+/g, "_")
    return partsItems.filter((item) => {
      const itemCat = normalizeCategoryName(item.category)
      return (
        itemCat === cleanCat ||
        itemCat === altCat ||
        (item.category || "").toUpperCase() === (cat || "").toUpperCase()
      )
    }).length
  }

  const handleStartRename = (cat) => {
    setEditingCat(cat)
    setRenameValue(cat)
    setStatusMessage("")
  }

  const handleSaveRename = async (oldCat) => {
    const clean = normalizeCategoryName(renameValue)
    if (!clean || clean === oldCat) {
      setEditingCat(null)
      return
    }
    setIsProcessing(true)
    setStatusMessage("")
    try {
      await onRenameCategory(oldCat, clean)
      setEditingCat(null)
      setStatusMessage(`Renamed "${oldCat}" to "${clean}".`)
    } catch {
      setStatusMessage("Failed to rename category.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async (cat) => {
    const usage = getUsageCount(cat)
    const confirmText =
      usage > 0
        ? `Category "${cat}" is currently used by ${usage} part(s). Deleting it will reassign those parts to "OTHER". Do you want to proceed?`
        : `Are you sure you want to delete category "${cat}"?`

    if (!window.confirm(confirmText)) return

    setIsProcessing(true)
    setStatusMessage("")
    try {
      await onDeleteCategory(cat)
      setStatusMessage(`Category "${cat}" deleted.`)
    } catch {
      setStatusMessage("Failed to delete category.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200/80 flex flex-col">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Layers className="text-[var(--color-maroon)]" size={16} />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Part Categories</h2>
              <p className="text-[11px] text-slate-500">Edit, rename, or delete categories</p>
            </div>
          </div>
          <button
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </header>

        {statusMessage ? (
          <div className="mx-4 mt-3 rounded-xl bg-slate-50 border border-slate-200/70 px-3 py-2 text-xs font-medium text-slate-700 flex items-center justify-between">
            <span>{statusMessage}</span>
            <button className="text-slate-400 hover:text-slate-700 cursor-pointer" onClick={() => setStatusMessage("")} type="button">
              <X size={13} />
            </button>
          </div>
        ) : null}

        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:bg-white placeholder:text-slate-400"
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter categories..."
              type="text"
              value={searchTerm}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100 space-y-1">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              No categories found matching &quot;{searchTerm}&quot;.
            </div>
          ) : (
            filteredCategories.map((cat) => {
              const count = getUsageCount(cat)
              const isEditingThis = editingCat === cat

              return (
                <div className="flex items-center justify-between py-2 gap-2" key={cat}>
                  {isEditingThis ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        autoFocus
                        className="flex-1 rounded-lg border border-[var(--color-maroon)] px-2.5 py-1 text-xs font-mono uppercase font-bold text-slate-900 outline-none"
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename(cat)
                          if (e.key === "Escape") setEditingCat(null)
                        }}
                        type="text"
                        value={renameValue}
                      />
                      <button
                        className="rounded-lg bg-[var(--color-maroon)] text-white p-1 hover:bg-[var(--color-maroon-hover)] transition cursor-pointer"
                        disabled={isProcessing}
                        onClick={() => handleSaveRename(cat)}
                        title="Save rename"
                        type="button"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        className="rounded-lg border border-slate-200 text-slate-500 p-1 hover:bg-slate-100 transition cursor-pointer"
                        disabled={isProcessing}
                        onClick={() => setEditingCat(null)}
                        title="Cancel"
                        type="button"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-semibold text-xs text-slate-900 truncate">
                          {cat}
                        </span>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-medium">
                          {count}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          disabled={isProcessing}
                          onClick={() => handleStartRename(cat)}
                          title={`Edit "${cat}"`}
                          type="button"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          disabled={isProcessing}
                          onClick={() => handleDelete(cat)}
                          title={`Delete "${cat}"`}
                          type="button"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>

        <footer className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 flex justify-end">
          <button
            className="rounded-xl px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            onClick={onClose}
            type="button"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}

function PartEditorModal({
  availableCategories = PART_CATEGORY_PRESETS,
  errorMessage,
  form,
  isEditing,
  isSaving,
  onAddCustomCategory,
  onChange,
  onClose,
  onOpenCategoryManager,
  onSave,
}) {
  if (!form) return null

  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false)
  const [customCategoryInput, setCustomCategoryInput] = useState("")

  const cost = Number(form.costPrice || 0)
  const markup = Number(form.markupAmount || 0)
  const totalEstimatedPartPrice = cost + markup

  const handleApplyCustomCategory = () => {
    const clean = normalizeCategoryName(customCategoryInput)
    if (clean) {
      onChange("category", clean)
      onAddCustomCategory?.(clean)
      setIsCustomCategoryMode(false)
      setCustomCategoryInput("")
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isCustomCategoryMode && customCategoryInput.trim()) {
      handleApplyCustomCategory()
    }
    onSave()
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:bg-white focus:ring-1 focus:ring-[var(--color-maroon)]/20 placeholder:text-slate-400"
  const labelClass = "text-[11px] font-semibold text-slate-600 block tracking-wide"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <form
        className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200/80 flex flex-col"
        onSubmit={handleSubmit}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {isEditing ? "Edit Service Part" : "New Service Part"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Service material item and internal markup computation.
            </p>
          </div>

          <button
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </header>

        {errorMessage ? (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/60 p-3 text-xs text-red-700 font-medium">
            <AlertCircle className="shrink-0" size={14} />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <div className="p-6 space-y-4 overflow-y-auto">
          <label className="block">
            <span className={labelClass}>Part / Material Description *</span>
            <input
              className={inputClass}
              maxLength="150"
              onChange={(event) => onChange("name", event.target.value)}
              placeholder="e.g. Laptop 15.6 FHD 144Hz IPS Screen (30-Pin EDP)"
              required
              value={form.name}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Device Category</span>
              <select
                className={inputClass}
                onChange={(event) => onChange("deviceType", event.target.value)}
                value={form.deviceType}
              >
                {DEVICE_TYPE_PRESETS.map((device) => (
                  <option key={device} value={device}>
                    {device}
                  </option>
                ))}
              </select>
            </label>

            <div className="block">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className={labelClass}>Part Category</span>
                <div className="flex items-center gap-1 text-[11px]">
                  {!isCustomCategoryMode ? (
                    <>
                      <button
                        className="font-semibold text-[var(--color-maroon)] hover:underline cursor-pointer"
                        onClick={() => {
                          setIsCustomCategoryMode(true)
                          setCustomCategoryInput("")
                        }}
                        type="button"
                      >
                        + Add
                      </button>
                      <span className="text-slate-300">·</span>
                      <button
                        className="text-slate-400 hover:text-slate-700 hover:underline cursor-pointer"
                        onClick={() => onOpenCategoryManager?.()}
                        type="button"
                      >
                        Manage
                      </button>
                    </>
                  ) : (
                    <button
                      className="text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
                      onClick={() => {
                        setIsCustomCategoryMode(false)
                        setCustomCategoryInput("")
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {!isCustomCategoryMode ? (
                <select
                  className={inputClass}
                  onChange={(event) => {
                    if (event.target.value === "__NEW_CUSTOM__") {
                      setIsCustomCategoryMode(true)
                      setCustomCategoryInput("")
                    } else if (event.target.value === "__MANAGE_CATEGORIES__") {
                      onOpenCategoryManager?.()
                    } else {
                      onChange("category", event.target.value)
                    }
                  }}
                  value={form.category}
                >
                  {availableCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  <option value="__NEW_CUSTOM__">+ Add Custom Category...</option>
                  <option value="__MANAGE_CATEGORIES__">⚙️ Edit / Delete Categories...</option>
                </select>
              ) : (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    autoFocus
                    className={`${inputClass} mt-0 font-mono uppercase`}
                    maxLength="50"
                    onChange={(event) => setCustomCategoryInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        handleApplyCustomCategory()
                      } else if (event.key === "Escape") {
                        setIsCustomCategoryMode(false)
                      }
                    }}
                    placeholder="e.g. CHARGER, HOUSING"
                    type="text"
                    value={customCategoryInput}
                  />
                  <button
                    className="rounded-xl bg-[var(--color-maroon)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-maroon-hover)] transition shrink-0 cursor-pointer disabled:opacity-50"
                    disabled={!customCategoryInput.trim()}
                    onClick={handleApplyCustomCategory}
                    type="button"
                  >
                    Use
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Part Cost Price (₱) *</span>
              <input
                className={`${inputClass} font-mono`}
                min="0"
                onChange={(event) => onChange("costPrice", event.target.value)}
                placeholder="0.00"
                required
                step="0.01"
                type="number"
                value={form.costPrice}
              />
            </label>

            <label className="block">
              <span className={labelClass}>Shop Markup Amount (₱)</span>
              <input
                className={`${inputClass} font-mono`}
                min="0"
                onChange={(event) => onChange("markupAmount", event.target.value)}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={form.markupAmount}
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 flex items-center justify-between text-xs">
            <div className="text-slate-500 text-[11px]">
              Cost <span className="font-mono text-slate-800 font-semibold">{formatMoney(cost)}</span> + Markup <span className="font-mono text-slate-800 font-semibold">{formatMoney(markup)}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Suggested SRP</span>
              <span className="font-mono font-bold text-sm text-[var(--color-maroon)]">{formatMoney(totalEstimatedPartPrice)}</span>
            </div>
          </div>

          <label className="block">
            <span className={labelClass}>Specifications / Notes</span>
            <textarea
              className={`${inputClass} resize-none`}
              maxLength="2000"
              onChange={(event) => onChange("description", event.target.value)}
              placeholder="Pin count, resolution, compatible models..."
              rows="2"
              value={form.description}
            />
          </label>

          <label className="block">
            <span className={labelClass}>Status</span>
            <select
              className={inputClass}
              onChange={(event) => onChange("status", event.target.value)}
              value={form.status}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3.5 bg-slate-50/30">
          <button
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-semibold text-white hover:bg-[var(--color-maroon-hover)] transition shadow-2xs disabled:opacity-50 cursor-pointer"
            disabled={isSaving}
            type="submit"
          >
            <Save size={13} />
            {isSaving ? "Saving…" : isEditing ? "Save Part" : "Create Part"}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default function ServicesMaintenancePage({ user }) {
  const [activeTab, setActiveTab] = useState("LABOR") // "LABOR" | "PARTS"

  // Service Catalog state
  const [catalogItems, setCatalogItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  // Parts Catalog state
  const [partsCatalogItems, setPartsCatalogItems] = useState([])
  const [isPartsLoading, setIsPartsLoading] = useState(true)
  const [partsErrorMessage, setPartsErrorMessage] = useState("")
  const [customPartCategories, setCustomPartCategories] = useState(() => {
    try {
      const raw = localStorage.getItem("arunafeltz_custom_part_categories")
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [deletedCategories, setDeletedCategories] = useState(() => {
    try {
      const raw = localStorage.getItem("arunafeltz_deleted_part_categories")
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false)

  const handleAddCustomCategory = useCallback((newCat) => {
    if (!newCat || typeof newCat !== "string") return
    const normalized = normalizeCategoryName(newCat)
    if (!normalized) return

    setDeletedCategories((prev) => {
      const altNorm = normalized.replace(/\s+/g, "_")
      if (!prev.includes(normalized) && !prev.includes(altNorm)) return prev
      const updated = prev.filter((c) => c !== normalized && c !== altNorm)
      try {
        localStorage.setItem("arunafeltz_deleted_part_categories", JSON.stringify(updated))
      } catch {
        // ignore
      }
      return updated
    })

    setCustomPartCategories((prev) => {
      const presetsNormalized = PART_CATEGORY_PRESETS.map(normalizeCategoryName)
      if (prev.some((c) => normalizeCategoryName(c) === normalized) || presetsNormalized.includes(normalized)) {
        return prev
      }
      const updated = [...prev, normalized]
      try {
        localStorage.setItem("arunafeltz_custom_part_categories", JSON.stringify(updated))
      } catch {
        // ignore
      }
      return updated
    })
  }, [])

  const availablePartCategories = useMemo(() => {
    const set = new Set(PART_CATEGORY_PRESETS.map(normalizeCategoryName))
    partsCatalogItems.forEach((item) => {
      if (item.category && item.category.trim()) {
        const norm = normalizeCategoryName(item.category)
        const displayNorm = norm.replace(/_/g, " ")
        set.add(displayNorm)
      }
    })
    customPartCategories.forEach((cat) => {
      if (cat && cat.trim()) {
        set.add(normalizeCategoryName(cat))
      }
    })
    deletedCategories.forEach((del) => {
      if (!del) return
      const norm = normalizeCategoryName(del)
      set.delete(norm)
      set.delete(norm.replace(/\s+/g, "_"))
      set.delete(norm.replace(/_/g, " "))
    })
    return Array.from(set)
  }, [partsCatalogItems, customPartCategories, deletedCategories])

  // Labor Filter state
  const [searchText, setSearchText] = useState("")
  const [deviceFilter, setDeviceFilter] = useState("")
  const [repairTypeFilter, setRepairTypeFilter] = useState("")
  const [quickFilter, setQuickFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)

  // Parts Filter state
  const [partsSearchText, setPartsSearchText] = useState("")
  const [partsDeviceFilter, setPartsDeviceFilter] = useState("")
  const [partsCategoryFilter, setPartsCategoryFilter] = useState("")
  const [partsStatusFilter, setPartsStatusFilter] = useState("")
  const [partsPage, setPartsPage] = useState(1)

  const pageSize = 10

  // Labor Modal states
  const [detailItem, setDetailItem] = useState(null)
  const [editingItem, setEditingItem] = useState(undefined)
  const [serviceForm, setServiceForm] = useState(null)
  const [serviceEditorError, setServiceEditorError] = useState("")
  const [isSavingService, setIsSavingService] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  // Parts Modal states
  const [detailPartItem, setDetailPartItem] = useState(null)
  const [editingPartItem, setEditingPartItem] = useState(undefined)
  const [partForm, setPartForm] = useState(null)
  const [partEditorError, setPartEditorError] = useState("")
  const [isSavingPart, setIsSavingPart] = useState(false)
  const [deletingPartId, setDeletingPartId] = useState(null)

  const canManageCatalog = useMemo(() => OWNER_ROLES.has(user?.role), [user?.role])

  const fetchCatalog = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      const response = await getServiceCatalog()
      const data = response?.data || response || []
      setCatalogItems(Array.isArray(data) ? data : [])
    } catch {
      setErrorMessage("Unable to load service catalog right now. Please refresh and try again.")
      setCatalogItems([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchPartsCatalog = useCallback(async () => {
    setIsPartsLoading(true)
    setPartsErrorMessage("")
    try {
      const response = await getServicePartsCatalog()
      const data = response?.data || response || []
      setPartsCatalogItems(Array.isArray(data) ? data : [])
    } catch {
      setPartsErrorMessage("Unable to load service parts catalog right now. Please refresh and try again.")
      setPartsCatalogItems([])
    } finally {
      setIsPartsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCatalog()
    fetchPartsCatalog()
  }, [fetchCatalog, fetchPartsCatalog])

  const clearFilters = () => {
    setSearchText("")
    setDeviceFilter("")
    setRepairTypeFilter("")
    setQuickFilter("")
    setStatusFilter("")
    setPage(1)
  }

  const clearPartsFilters = () => {
    setPartsSearchText("")
    setPartsDeviceFilter("")
    setPartsCategoryFilter("")
    setPartsStatusFilter("")
    setPartsPage(1)
  }

  const handleRenameCategory = useCallback(
    async (oldCategory, newCategory) => {
      if (!oldCategory || !newCategory) return
      const normalizedOld = normalizeCategoryName(oldCategory)
      const normalizedNew = normalizeCategoryName(newCategory)
      if (!normalizedNew || normalizedOld === normalizedNew) return

      const altOld = normalizedOld.replace(/\s+/g, "_")
      const altNew = normalizedNew.replace(/\s+/g, "_")

      // Add old to deletedCategories so preset or existing category is hidden
      setDeletedCategories((prev) => {
        const set = new Set(prev)
        set.add(normalizedOld)
        set.add(altOld)
        set.delete(normalizedNew)
        set.delete(altNew)
        const updated = Array.from(set)
        try {
          localStorage.setItem("arunafeltz_deleted_part_categories", JSON.stringify(updated))
        } catch {
          // ignore
        }
        return updated
      })

      // Update customPartCategories
      setCustomPartCategories((prev) => {
        const filtered = prev.filter(
          (c) => normalizeCategoryName(c) !== normalizedOld && normalizeCategoryName(c) !== altOld
        )
        const updated = Array.from(new Set([...filtered, normalizedNew]))
        try {
          localStorage.setItem("arunafeltz_custom_part_categories", JSON.stringify(updated))
        } catch {
          // ignore
        }
        return updated
      })

      // Update any parts that use oldCategory in the database
      const affectedParts = partsCatalogItems.filter((p) => {
        const pCat = normalizeCategoryName(p.category)
        return (
          pCat === normalizedOld ||
          pCat === altOld ||
          (p.category || "").toUpperCase() === oldCategory.toUpperCase()
        )
      })

      if (affectedParts.length > 0) {
        for (const part of affectedParts) {
          await updateServicePartsCatalogItem(part.id, {
            category: normalizedNew,
          })
        }
        await fetchPartsCatalog()
      }

      if (
        partForm &&
        (normalizeCategoryName(partForm.category) === normalizedOld ||
          (partForm.category || "").toUpperCase() === oldCategory.toUpperCase())
      ) {
        setPartForm((prev) => (prev ? { ...prev, category: normalizedNew } : prev))
      }
      if (
        partsCategoryFilter &&
        (normalizeCategoryName(partsCategoryFilter) === normalizedOld ||
          partsCategoryFilter.toUpperCase() === oldCategory.toUpperCase())
      ) {
        setPartsCategoryFilter(normalizedNew)
      }
    },
    [partsCatalogItems, fetchPartsCatalog, partForm, partsCategoryFilter]
  )

  const handleDeleteCategory = useCallback(
    async (categoryToDelete) => {
      if (!categoryToDelete) return
      const normalized = normalizeCategoryName(categoryToDelete)
      if (!normalized) return

      const alt = normalized.replace(/\s+/g, "_")
      const altSpace = normalized.replace(/_/g, " ")

      // Add to deletedCategories
      setDeletedCategories((prev) => {
        const updated = Array.from(new Set([...prev, normalized, alt, altSpace]))
        try {
          localStorage.setItem("arunafeltz_deleted_part_categories", JSON.stringify(updated))
        } catch {
          // ignore
        }
        return updated
      })

      // Remove from customPartCategories
      setCustomPartCategories((prev) => {
        const updated = prev.filter((c) => {
          const cNorm = normalizeCategoryName(c)
          return cNorm !== normalized && cNorm !== alt && cNorm !== altSpace
        })
        try {
          localStorage.setItem("arunafeltz_custom_part_categories", JSON.stringify(updated))
        } catch {
          // ignore
        }
        return updated
      })

      // Reassign any parts currently using this category to "OTHER"
      const affectedParts = partsCatalogItems.filter((p) => {
        const pCat = normalizeCategoryName(p.category)
        return (
          pCat === normalized ||
          pCat === alt ||
          pCat === altSpace ||
          (p.category || "").toUpperCase() === categoryToDelete.toUpperCase()
        )
      })

      if (affectedParts.length > 0) {
        for (const part of affectedParts) {
          await updateServicePartsCatalogItem(part.id, {
            category: "OTHER",
          })
        }
        await fetchPartsCatalog()
      }

      if (
        partForm &&
        (normalizeCategoryName(partForm.category) === normalized ||
          (partForm.category || "").toUpperCase() === categoryToDelete.toUpperCase())
      ) {
        setPartForm((prev) => (prev ? { ...prev, category: "OTHER" } : prev))
      }
      if (
        partsCategoryFilter &&
        (normalizeCategoryName(partsCategoryFilter) === normalized ||
          partsCategoryFilter.toUpperCase() === categoryToDelete.toUpperCase())
      ) {
        setPartsCategoryFilter("")
      }
    },
    [partsCatalogItems, fetchPartsCatalog, partForm, partsCategoryFilter]
  )

  // Labor Catalog actions
  const openNewService = () => {
    setEditingItem(null)
    setServiceEditorError("")
    setServiceForm({ ...EMPTY_SERVICE_FORM })
  }

  const openServiceEditor = (item) => {
    setEditingItem(item)
    setServiceEditorError("")
    setServiceForm({
      name: item.name || "",
      deviceType: item.deviceType || "LAPTOP",
      repairType: item.repairType || "ORDINARY_REPAIR",
      basePrice: item.basePrice != null ? String(item.basePrice) : "0",
      markupPercent: item.markupPercent != null ? String(item.markupPercent) : "0",
      description: item.description || "",
      isQuickService: Boolean(item.isQuickService),
      status: item.isActive === false ? "INACTIVE" : "ACTIVE",
    })
  }

  const closeServiceEditor = () => {
    if (isSavingService) return
    setEditingItem(undefined)
    setServiceForm(null)
    setServiceEditorError("")
  }

  const updateServiceForm = (field, value) => {
    setServiceForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const saveService = async () => {
    if (!serviceForm || isSavingService) return

    if (!serviceForm.name.trim()) {
      setServiceEditorError("Service Name is required.")
      return
    }

    if (!serviceForm.deviceType.trim()) {
      setServiceEditorError("Unit / Device Category is required.")
      return
    }

    const basePriceNum = Number(serviceForm.basePrice) || 0
    if (basePriceNum < 0) {
      setServiceEditorError("Base Price cannot be negative.")
      return
    }

    setIsSavingService(true)
    setServiceEditorError("")

    const payload = {
      name: serviceForm.name.trim(),
      deviceType: serviceForm.deviceType.trim(),
      repairType: serviceForm.repairType,
      basePrice: basePriceNum,
      markupPercent: Number(serviceForm.markupPercent) || 0,
      description: serviceForm.description.trim(),
      isQuickService: Boolean(serviceForm.isQuickService),
      isActive: serviceForm.status !== "INACTIVE",
    }

    try {
      if (editingItem?.id) {
        await updateServiceCatalogItem(editingItem.id, payload)
      } else {
        await createServiceCatalogItem(payload)
      }

      setServiceForm(null)
      setEditingItem(undefined)
      await fetchCatalog()
    } catch (error) {
      setServiceEditorError(
        error?.response?.data?.message ||
          (editingItem?.id ? "Unable to update this service rate." : "Unable to create this service rate.")
      )
    } finally {
      setIsSavingService(false)
    }
  }

  const handleDeleteService = async (item) => {
    if (!window.confirm(`Are you sure you want to delete service rate "${item.name}"?`)) {
      return
    }

    setDeletingId(item.id)
    try {
      await deleteServiceCatalogItem(item.id)
      await fetchCatalog()
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || "Failed to delete service rate.")
    } finally {
      setDeletingId(null)
    }
  }

  // Parts Catalog actions
  const openNewPart = () => {
    setEditingPartItem(null)
    setPartEditorError("")
    setPartForm({ ...EMPTY_PART_FORM })
  }

  const openPartEditor = (item) => {
    setEditingPartItem(item)
    setPartEditorError("")
    setPartForm({
      name: item.name || "",
      deviceType: item.deviceType || "LAPTOP",
      category: item.category || "SCREEN",
      costPrice: item.costPrice != null ? String(item.costPrice) : "0",
      markupAmount: item.markupAmount != null ? String(item.markupAmount) : "0",
      description: item.description || "",
      status: item.isActive === false ? "INACTIVE" : "ACTIVE",
    })
  }

  const closePartEditor = () => {
    if (isSavingPart) return
    setEditingPartItem(undefined)
    setPartForm(null)
    setPartEditorError("")
  }

  const updatePartForm = (field, value) => {
    setPartForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const savePart = async () => {
    if (!partForm || isSavingPart) return

    if (!partForm.name.trim()) {
      setPartEditorError("Part / Material description is required.")
      return
    }

    const costNum = Number(partForm.costPrice) || 0
    if (costNum < 0) {
      setPartEditorError("Cost price cannot be negative.")
      return
    }

    const markupNum = Number(partForm.markupAmount) || 0
    if (markupNum < 0) {
      setPartEditorError("Markup amount cannot be negative.")
      return
    }

    setIsSavingPart(true)
    setPartEditorError("")

    const categoryClean = normalizeCategoryName(partForm.category) || "OTHER"
    handleAddCustomCategory(categoryClean)

    const payload = {
      name: partForm.name.trim(),
      deviceType: partForm.deviceType?.trim() || "LAPTOP",
      category: categoryClean,
      costPrice: costNum,
      markupAmount: markupNum,
      description: partForm.description?.trim() || "",
      isActive: partForm.status !== "INACTIVE",
    }

    try {
      if (editingPartItem?.id) {
        await updateServicePartsCatalogItem(editingPartItem.id, payload)
      } else {
        await createServicePartsCatalogItem(payload)
      }

      setPartForm(null)
      setEditingPartItem(undefined)
      await fetchPartsCatalog()
    } catch (error) {
      setPartEditorError(
        error?.response?.data?.message ||
          (editingPartItem?.id ? "Unable to update this service part." : "Unable to create this service part.")
      )
    } finally {
      setIsSavingPart(false)
    }
  }

  const handleDeletePart = async (item) => {
    if (!window.confirm(`Are you sure you want to delete service part "${item.name}"?`)) {
      return
    }

    setDeletingPartId(item.id)
    try {
      await deleteServicePartsCatalogItem(item.id)
      await fetchPartsCatalog()
    } catch (error) {
      setPartsErrorMessage(error?.response?.data?.message || "Failed to delete service part.")
    } finally {
      setDeletingPartId(null)
    }
  }

  // Filtered Labor List
  const filteredCatalog = useMemo(() => {
    return catalogItems.filter((item) => {
      if (statusFilter === "ACTIVE" && item.isActive === false) return false
      if (statusFilter === "INACTIVE" && item.isActive !== false) return false
      if (repairTypeFilter && item.repairType !== repairTypeFilter) return false
      if (quickFilter === "true" && !item.isQuickService) return false
      if (quickFilter === "false" && item.isQuickService) return false
      if (
        deviceFilter &&
        !item.deviceType?.toLowerCase().includes(deviceFilter.toLowerCase())
      ) {
        return false
      }

      if (searchText.trim()) {
        const query = searchText.trim().toLowerCase()
        const matchName = item.name?.toLowerCase().includes(query)
        const matchDevice = item.deviceType?.toLowerCase().includes(query)
        const matchDesc = item.description?.toLowerCase().includes(query)
        if (!matchName && !matchDevice && !matchDesc) return false
      }

      return true
    })
  }, [catalogItems, searchText, deviceFilter, repairTypeFilter, quickFilter, statusFilter])

  const totalLaborItems = filteredCatalog.length
  const totalLaborPages = Math.max(1, Math.ceil(totalLaborItems / pageSize))
  const paginatedLaborItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return filteredCatalog.slice(startIndex, startIndex + pageSize)
  }, [filteredCatalog, page, pageSize])

  // Filtered Parts List
  const filteredPartsCatalog = useMemo(() => {
    return partsCatalogItems.filter((item) => {
      if (partsStatusFilter === "ACTIVE" && item.isActive === false) return false
      if (partsStatusFilter === "INACTIVE" && item.isActive !== false) return false
      if (partsCategoryFilter) {
        const filterNorm = normalizeCategoryName(partsCategoryFilter)
        const itemCatNorm = normalizeCategoryName(item.category)
        if (
          filterNorm !== itemCatNorm &&
          filterNorm !== itemCatNorm.replace(/_/g, " ") &&
          filterNorm.replace(/_/g, " ") !== itemCatNorm
        ) {
          return false
        }
      }
      if (
        partsDeviceFilter &&
        !item.deviceType?.toLowerCase().includes(partsDeviceFilter.toLowerCase())
      ) {
        return false
      }

      if (partsSearchText.trim()) {
        const query = partsSearchText.trim().toLowerCase()
        const matchName = item.name?.toLowerCase().includes(query)
        const matchDevice = item.deviceType?.toLowerCase().includes(query)
        const matchCategory = item.category?.toLowerCase().includes(query)
        const matchDesc = item.description?.toLowerCase().includes(query)
        if (!matchName && !matchDevice && !matchCategory && !matchDesc) return false
      }

      return true
    })
  }, [partsCatalogItems, partsSearchText, partsDeviceFilter, partsCategoryFilter, partsStatusFilter])

  const totalPartsItems = filteredPartsCatalog.length
  const totalPartsPages = Math.max(1, Math.ceil(totalPartsItems / pageSize))
  const paginatedPartsItems = useMemo(() => {
    const startIndex = (partsPage - 1) * pageSize
    return filteredPartsCatalog.slice(startIndex, startIndex + pageSize)
  }, [filteredPartsCatalog, partsPage, pageSize])

  return (
    <div className="space-y-5">
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Services &amp; Parts Maintenance
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Standard repair rates, technician fees, service parts, and shop markup economics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            aria-label="Refresh catalog list"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            disabled={activeTab === "LABOR" ? isLoading : isPartsLoading}
            onClick={activeTab === "LABOR" ? fetchCatalog : fetchPartsCatalog}
            type="button"
          >
            <RefreshCw className={(activeTab === "LABOR" ? isLoading : isPartsLoading) ? "animate-spin" : ""} size={13} />
            Refresh
          </button>

          {canManageCatalog ? (
            activeTab === "LABOR" ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-maroon-hover)] transition shadow-2xs cursor-pointer"
                onClick={openNewService}
                type="button"
              >
                <Plus size={14} />
                New Service Rate
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-maroon-hover)] transition shadow-2xs cursor-pointer"
                onClick={openNewPart}
                type="button"
              >
                <Plus size={14} />
                New Service Part
              </button>
            )
          ) : null}
        </div>
      </div>

      {/* Primary Tab Switcher (Segmented Minimalist) */}
      <div className="inline-flex p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
        <button
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === "LABOR"
              ? "bg-white text-slate-900 shadow-2xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setActiveTab("LABOR")}
          type="button"
        >
          <Wrench size={13} />
          <span>Labor &amp; Service Rates</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
            activeTab === "LABOR" ? "bg-slate-100 text-slate-700" : "bg-slate-200/60 text-slate-600"
          }`}>
            {catalogItems.length}
          </span>
        </button>

        <button
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === "PARTS"
              ? "bg-white text-slate-900 shadow-2xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setActiveTab("PARTS")}
          type="button"
        >
          <Layers size={13} />
          <span>Service Parts &amp; Markup Catalog</span>
          <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
            activeTab === "PARTS" ? "bg-slate-100 text-slate-700" : "bg-slate-200/60 text-slate-600"
          }`}>
            {partsCatalogItems.length}
          </span>
        </button>
      </div>

      {activeTab === "LABOR" ? (
        /* TAB 1: LABOR CATALOG */
        <>
          {/* Filter Section Card */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2 text-xs">
                <Search className="text-slate-400 shrink-0" size={14} />
                <input
                  className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400 text-xs"
                  onChange={(event) => {
                    setSearchText(event.target.value)
                    setPage(1)
                  }}
                  placeholder="Search service name, unit type, or scope..."
                  value={searchText}
                />
                {searchText ? (
                  <button
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    onClick={() => {
                      setSearchText("")
                      setPage(1)
                    }}
                    type="button"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <button
                className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                onClick={clearFilters}
                type="button"
              >
                Clear filters
              </button>
            </div>

            {/* Device Quick Filter Pills */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers size={12} className="text-[var(--color-maroon)]" />
                  Filter by Device:
                </span>
                {deviceFilter ? (
                  <button
                    className="text-[11px] font-semibold text-[var(--color-maroon)] hover:underline cursor-pointer"
                    onClick={() => {
                      setDeviceFilter("")
                      setPage(1)
                    }}
                    type="button"
                  >
                    Reset ({deviceFilter})
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <button
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    !deviceFilter
                      ? "bg-[var(--color-maroon)] text-white shadow-2xs"
                      : "bg-slate-100/70 text-slate-600 hover:bg-slate-100 border border-slate-200/50"
                  }`}
                  onClick={() => {
                    setDeviceFilter("")
                    setPage(1)
                  }}
                  type="button"
                >
                  All Devices
                </button>

                {DEVICE_TYPE_PRESETS.map((preset) => {
                  const isActive = deviceFilter?.toUpperCase() === preset
                  return (
                    <button
                      key={preset}
                      className={`rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition cursor-pointer ${
                        isActive
                          ? "bg-[var(--color-maroon)] text-white shadow-2xs"
                          : "bg-slate-100/70 text-slate-600 hover:bg-slate-100 border border-slate-200/50"
                      }`}
                      onClick={() => {
                        setDeviceFilter(isActive ? "" : preset)
                        setPage(1)
                      }}
                      type="button"
                    >
                      {preset}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4 pt-1">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Unit Type
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-1.5 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:bg-white"
                  onChange={(event) => {
                    setDeviceFilter(event.target.value)
                    setPage(1)
                  }}
                  value={deviceFilter}
                >
                  <option value="">All device types</option>
                  {DEVICE_TYPE_PRESETS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Classification
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-1.5 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:bg-white"
                  onChange={(event) => {
                    setRepairTypeFilter(event.target.value)
                    setPage(1)
                  }}
                  value={repairTypeFilter}
                >
                  <option value="">All classifications</option>
                  <option value="ORDINARY_REPAIR">Standard Repair</option>
                  <option value="BOARD_LEVEL_REPAIR">Board Level Repair</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Service Mode
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-1.5 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:bg-white"
                  onChange={(event) => {
                    setQuickFilter(event.target.value)
                    setPage(1)
                  }}
                  value={quickFilter}
                >
                  <option value="">All service modes</option>
                  <option value="true">Quick / Express only</option>
                  <option value="false">Standard queue only</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-1.5 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:bg-white"
                  onChange={(event) => {
                    setStatusFilter(event.target.value)
                    setPage(1)
                  }}
                  value={statusFilter}
                >
                  <option value="">All status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
            </div>
          </section>

          {errorMessage ? (
            <section className="flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/60 p-3 text-xs font-medium text-red-700">
              <AlertCircle className="shrink-0" size={15} />
              <span>{errorMessage}</span>
            </section>
          ) : null}

          {/* Labor Table Section */}
          <section className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
            {isLoading ? (
              <div className="p-6 text-xs font-medium text-slate-400">
                Loading service rates... Please wait.
              </div>
            ) : paginatedLaborItems.length === 0 ? (
              <div className="grid place-items-center p-8 text-center">
                <Wrench className="text-slate-300" size={32} />
                <p className="mt-2 text-xs font-semibold text-slate-700">
                  No matching service rates found
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Try clearing the filters or add a new service rate.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="bg-slate-50/60 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-2.5">Service Name</th>
                          <th className="px-4 py-2.5">Device</th>
                          <th className="px-4 py-2.5">Classification</th>
                          <th className="px-4 py-2.5">Base Price</th>
                          <th className="px-4 py-2.5">Markup</th>
                          <th className="px-4 py-2.5">Final Rate</th>
                          <th className="px-4 py-2.5">Mode</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {paginatedLaborItems.map((item) => {
                          const isBoard = item.repairType === "BOARD_LEVEL_REPAIR"
                          const basePrice = Number(item.basePrice || 0)
                          const markup = Number(item.markupPercent || 0)
                          const finalPrice = basePrice + basePrice * (markup / 100)

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3 min-w-[200px]">
                                <p className="font-semibold text-slate-900">
                                  {item.name}
                                </p>
                                {item.description ? (
                                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                    {item.description}
                                  </p>
                                ) : null}
                              </td>

                              <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                                {item.deviceType || "General"}
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${
                                  isBoard
                                    ? "bg-purple-50 text-purple-700 border border-purple-200/50"
                                    : "bg-slate-100 text-slate-600 border border-slate-200/50"
                                }`}>
                                  {isBoard ? "Board Level" : "Standard"}
                                </span>
                              </td>

                              <td className="px-4 py-3 font-mono font-medium text-slate-700 whitespace-nowrap">
                                {formatMoney(basePrice)}
                              </td>

                              <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                                {markup}%
                              </td>

                              <td className="px-4 py-3 font-mono font-bold text-[var(--color-maroon)] whitespace-nowrap">
                                {formatMoney(finalPrice)}
                              </td>

                              <td className="px-4 py-3 text-[11px] whitespace-nowrap">
                                {item.isQuickService ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200/50">
                                    <Zap size={10} /> Quick
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Standard</span>
                                )}
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <StatusPill status={item.isActive !== false ? "ACTIVE" : "INACTIVE"} />
                              </td>

                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                    onClick={() => setDetailItem(item)}
                                    title="View details"
                                    type="button"
                                  >
                                    <Eye size={14} />
                                  </button>

                                  {canManageCatalog ? (
                                    <>
                                      <button
                                        className="p-1 rounded-lg text-slate-400 hover:text-[var(--color-maroon)] hover:bg-slate-100 transition cursor-pointer"
                                        onClick={() => openServiceEditor(item)}
                                        title="Edit rate"
                                        type="button"
                                      >
                                        <Edit3 size={14} />
                                      </button>

                                      <button
                                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                        disabled={deletingId === item.id}
                                        onClick={() => handleDeleteService(item)}
                                        title="Delete rate"
                                        type="button"
                                      >
                                        {deletingId === item.id ? (
                                          <LoaderCircle className="animate-spin" size={14} />
                                        ) : (
                                          <Trash2 size={14} />
                                        )}
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Cards View */}
                <div className="grid gap-2.5 p-3 lg:hidden">
                  {paginatedLaborItems.map((item) => {
                    const isBoard = item.repairType === "BOARD_LEVEL_REPAIR"
                    const basePrice = Number(item.basePrice || 0)
                    const markup = Number(item.markupPercent || 0)
                    const finalPrice = basePrice + basePrice * (markup / 100)

                    return (
                      <article
                        className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-2.5"
                        key={item.id}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="text-xs font-semibold text-slate-900 truncate">
                              {item.name}
                            </h2>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {item.deviceType} · {isBoard ? "Board Level" : "Standard"}
                            </p>
                          </div>
                          <StatusPill status={item.isActive !== false ? "ACTIVE" : "INACTIVE"} />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Base Price</span>
                            <span className="font-mono font-medium text-slate-700">{formatMoney(basePrice)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Final Rate</span>
                            <span className="font-mono font-bold text-[var(--color-maroon)]">{formatMoney(finalPrice)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            className="flex-1 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition"
                            onClick={() => setDetailItem(item)}
                            type="button"
                          >
                            View
                          </button>
                          {canManageCatalog ? (
                            <button
                              className="flex-1 py-1.5 text-xs font-medium text-[var(--color-maroon)] bg-[var(--color-maroon-soft)]/20 hover:bg-[var(--color-maroon-soft)]/40 rounded-lg transition"
                              onClick={() => openServiceEditor(item)}
                              type="button"
                            >
                              Edit
                            </button>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
                  <span>
                    Showing {paginatedLaborItems.length} of {totalLaborItems} rates
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      className="rounded-lg px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      type="button"
                    >
                      Previous
                    </button>
                    <span className="font-mono text-slate-700 font-medium">
                      {page} / {totalLaborPages}
                    </span>
                    <button
                      className="rounded-lg px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
                      disabled={page >= totalLaborPages}
                      onClick={() => setPage((p) => p + 1)}
                      type="button"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      ) : (
        /* TAB 2: SERVICE PARTS CATALOG */
        <>
          {/* Parts Filter Section Card */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2 text-xs">
                <Search className="text-slate-400 shrink-0" size={14} />
                <input
                  className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400 text-xs"
                  onChange={(event) => {
                    setPartsSearchText(event.target.value)
                    setPartsPage(1)
                  }}
                  placeholder="Search replacement part (e.g. LCD Screen, IC chip, battery, fan)..."
                  value={partsSearchText}
                />
                {partsSearchText ? (
                  <button
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    onClick={() => {
                      setPartsSearchText("")
                      setPartsPage(1)
                    }}
                    type="button"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <button
                className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                onClick={clearPartsFilters}
                type="button"
              >
                Clear filters
              </button>
            </div>

            {/* Quick Filter by Category */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers size={12} className="text-[var(--color-maroon)]" />
                  Filter by Category:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-700 hover:underline cursor-pointer"
                    onClick={() => setIsCategoryManagerOpen(true)}
                    type="button"
                  >
                    <Edit3 size={11} />
                    Manage Categories
                  </button>
                  {partsCategoryFilter ? (
                    <>
                      <span className="text-slate-300">·</span>
                      <button
                        className="text-[11px] font-semibold text-[var(--color-maroon)] hover:underline cursor-pointer"
                        onClick={() => {
                          setPartsCategoryFilter("")
                          setPartsPage(1)
                        }}
                        type="button"
                      >
                        Reset ({partsCategoryFilter})
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <button
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    !partsCategoryFilter
                      ? "bg-[var(--color-maroon)] text-white shadow-2xs"
                      : "bg-slate-100/70 text-slate-600 hover:bg-slate-100 border border-slate-200/50"
                  }`}
                  onClick={() => {
                    setPartsCategoryFilter("")
                    setPartsPage(1)
                  }}
                  type="button"
                >
                  All Categories
                </button>

                {availablePartCategories.map((cat) => {
                  const isActive = partsCategoryFilter === cat
                  return (
                    <button
                      key={cat}
                      className={`rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition cursor-pointer ${
                        isActive
                          ? "bg-[var(--color-maroon)] text-white shadow-2xs"
                          : "bg-slate-100/70 text-slate-600 hover:bg-slate-100 border border-slate-200/50"
                      }`}
                      onClick={() => {
                        setPartsCategoryFilter(isActive ? "" : cat)
                        setPartsPage(1)
                      }}
                      type="button"
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-2.5 md:grid-cols-3 pt-1">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Device Compatibility
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-1.5 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:bg-white"
                  onChange={(event) => {
                    setPartsDeviceFilter(event.target.value)
                    setPartsPage(1)
                  }}
                  value={partsDeviceFilter}
                >
                  <option value="">All device types</option>
                  {DEVICE_TYPE_PRESETS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Part Category
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-1.5 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:bg-white"
                  onChange={(event) => {
                    setPartsCategoryFilter(event.target.value)
                    setPartsPage(1)
                  }}
                  value={partsCategoryFilter}
                >
                  <option value="">All categories</option>
                  {availablePartCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-1.5 text-xs text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:bg-white"
                  onChange={(event) => {
                    setPartsStatusFilter(event.target.value)
                    setPartsPage(1)
                  }}
                  value={partsStatusFilter}
                >
                  <option value="">All status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
            </div>
          </section>

          {partsErrorMessage ? (
            <section className="flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/60 p-3 text-xs font-medium text-red-700">
              <AlertCircle className="shrink-0" size={15} />
              <span>{partsErrorMessage}</span>
            </section>
          ) : null}

          {/* Parts Table Section */}
          <section className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
            {isPartsLoading ? (
              <div className="p-6 text-xs font-medium text-slate-400">
                Loading service parts catalog... Please wait.
              </div>
            ) : paginatedPartsItems.length === 0 ? (
              <div className="grid place-items-center p-8 text-center">
                <Layers className="text-slate-300" size={32} />
                <p className="mt-2 text-xs font-semibold text-slate-700">
                  No matching service parts found
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Add replacement screens, chips, or materials to your catalog.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="bg-slate-50/60 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-2.5">Part / Material Name</th>
                          <th className="px-4 py-2.5">Device</th>
                          <th className="px-4 py-2.5">Category</th>
                          <th className="px-4 py-2.5">Part Cost (₱)</th>
                          <th className="px-4 py-2.5">Shop Markup (₱)</th>
                          <th className="px-4 py-2.5">Suggested SRP</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {paginatedPartsItems.map((item) => {
                          const cost = Number(item.costPrice || 0)
                          const markup = Number(item.markupAmount || 0)
                          const suggestedSrp = cost + markup

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3 min-w-[220px]">
                                <p className="font-semibold text-slate-900">
                                  {item.name}
                                </p>
                                {item.description ? (
                                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                    {item.description}
                                  </p>
                                ) : null}
                              </td>

                              <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                                {item.deviceType || "General"}
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200/50">
                                  {(item.category || "OTHER").replace(/_/g, " ")}
                                </span>
                              </td>

                              <td className="px-4 py-3 font-mono font-medium text-slate-700 whitespace-nowrap">
                                {formatMoney(cost)}
                              </td>

                              <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                                +{formatMoney(markup)}
                              </td>

                              <td className="px-4 py-3 font-mono font-bold text-[var(--color-maroon)] whitespace-nowrap">
                                {formatMoney(suggestedSrp)}
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <StatusPill status={item.isActive !== false ? "ACTIVE" : "INACTIVE"} />
                              </td>

                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                    onClick={() => setDetailPartItem(item)}
                                    title="View part details"
                                    type="button"
                                  >
                                    <Eye size={14} />
                                  </button>

                                  {canManageCatalog ? (
                                    <>
                                      <button
                                        className="p-1 rounded-lg text-slate-400 hover:text-[var(--color-maroon)] hover:bg-slate-100 transition cursor-pointer"
                                        onClick={() => openPartEditor(item)}
                                        title="Edit part"
                                        type="button"
                                      >
                                        <Edit3 size={14} />
                                      </button>

                                      <button
                                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                        disabled={deletingPartId === item.id}
                                        onClick={() => handleDeletePart(item)}
                                        title="Delete part"
                                        type="button"
                                      >
                                        {deletingPartId === item.id ? (
                                          <LoaderCircle className="animate-spin" size={14} />
                                        ) : (
                                          <Trash2 size={14} />
                                        )}
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Parts View */}
                <div className="grid gap-2.5 p-3 lg:hidden">
                  {paginatedPartsItems.map((item) => {
                    const cost = Number(item.costPrice || 0)
                    const markup = Number(item.markupAmount || 0)
                    const suggestedSrp = cost + markup

                    return (
                      <article
                        className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-2.5"
                        key={item.id}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="text-xs font-semibold text-slate-900 truncate">
                              {item.name}
                            </h2>
                            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                              {item.deviceType} · {(item.category || "OTHER").replace(/_/g, " ")}
                            </p>
                          </div>
                          <StatusPill status={item.isActive !== false ? "ACTIVE" : "INACTIVE"} />
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Cost</span>
                            <span className="font-mono font-medium text-slate-700">{formatMoney(cost)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Markup</span>
                            <span className="font-mono font-medium text-slate-600">+{formatMoney(markup)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">SRP</span>
                            <span className="font-mono font-bold text-[var(--color-maroon)]">{formatMoney(suggestedSrp)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            className="flex-1 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition"
                            onClick={() => setDetailPartItem(item)}
                            type="button"
                          >
                            View
                          </button>
                          {canManageCatalog ? (
                            <button
                              className="flex-1 py-1.5 text-xs font-medium text-[var(--color-maroon)] bg-[var(--color-maroon-soft)]/20 hover:bg-[var(--color-maroon-soft)]/40 rounded-lg transition"
                              onClick={() => openPartEditor(item)}
                              type="button"
                            >
                              Edit
                            </button>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                </div>

                {/* Parts Pagination Controls */}
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
                  <span>
                    Showing {paginatedPartsItems.length} of {totalPartsItems} parts
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      className="rounded-lg px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
                      disabled={partsPage <= 1}
                      onClick={() => setPartsPage((p) => p - 1)}
                      type="button"
                    >
                      Previous
                    </button>
                    <span className="font-mono text-slate-700 font-medium">
                      {partsPage} / {totalPartsPages}
                    </span>
                    <button
                      className="rounded-lg px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
                      disabled={partsPage >= totalPartsPages}
                      onClick={() => setPartsPage((p) => p + 1)}
                      type="button"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {/* Labor Modals */}
      {detailItem ? (
        <ServiceDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
      ) : null}

      {serviceForm ? (
        <ServiceEditorModal
          errorMessage={serviceEditorError}
          form={serviceForm}
          isEditing={Boolean(editingItem?.id)}
          isSaving={isSavingService}
          onChange={updateServiceForm}
          onClose={closeServiceEditor}
          onSave={saveService}
        />
      ) : null}

      {/* Parts Modals */}
      {detailPartItem ? (
        <PartDetailModal item={detailPartItem} onClose={() => setDetailPartItem(null)} />
      ) : null}

      {partForm ? (
        <PartEditorModal
          availableCategories={availablePartCategories}
          errorMessage={partEditorError}
          form={partForm}
          isEditing={Boolean(editingPartItem?.id)}
          isSaving={isSavingPart}
          onAddCustomCategory={handleAddCustomCategory}
          onChange={updatePartForm}
          onClose={closePartEditor}
          onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
          onSave={savePart}
        />
      ) : null}

      {/* Category Manager Modal */}
      {isCategoryManagerOpen ? (
        <ManagePartCategoriesModal
          categories={availablePartCategories}
          onClose={() => setIsCategoryManagerOpen(false)}
          onDeleteCategory={handleDeleteCategory}
          onRenameCategory={handleRenameCategory}
          partsItems={partsCatalogItems}
        />
      ) : null}
    </div>
  )
}
