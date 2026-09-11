import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
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
  "IC_CHIP",
  "PORT",
  "CONSUMABLE",
  "OTHER",
]

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
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        isActive
          ? "bg-green-50 text-green-700 border border-green-200"
          : "bg-slate-100 text-slate-600 border border-slate-200"
      }`}
    >
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Service Rate Details
            </span>
            <h2 className="mt-0.5 truncate text-base font-black text-slate-900 leading-tight">
              {item.name}
            </h2>
            <p className="text-xs font-semibold text-slate-500 font-mono">
              {item.deviceType} • {isBoard ? "Board Level Repair" : "Standard Repair"}
            </p>
          </div>

          <button
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Service Name</p>
              <p className="mt-1 font-bold text-slate-900">{item.name}</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Unit / Device Type</p>
              <p className="mt-1 font-bold text-slate-900">{item.deviceType || "General"}</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Repair Classification</p>
              <p className="mt-1 font-bold text-slate-900">
                {isBoard ? "🔬 Board Level Repair" : "🔧 Standard / Ordinary Repair"}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {isBoard ? "Requires Senior Technician qualification" : "Open to all branch technicians"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Service Mode</p>
              <p className="mt-1 font-bold text-slate-900">
                {item.isQuickService ? "⚡ Quick / Same-Day Service" : "Standard Queue"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Standard Pricing</p>
            <div className="grid gap-2 grid-cols-3 text-xs">
              <div className="rounded-lg bg-slate-50 p-2.5 text-center border border-slate-100">
                <p className="text-[10px] font-bold text-slate-500">Base Service Charge</p>
                <p className="mt-0.5 font-mono font-bold text-slate-900">{formatMoney(basePrice)}</p>
              </div>

              <div className="rounded-lg bg-slate-50 p-2.5 text-center border border-slate-100">
                <p className="text-[10px] font-bold text-slate-500">Default Markup</p>
                <p className="mt-0.5 font-mono font-bold text-slate-900">{markup}%</p>
              </div>

              <div className="rounded-lg bg-[var(--color-soft)] p-2.5 text-center border border-[var(--color-border)]">
                <p className="text-[10px] font-bold text-[var(--color-maroon)]">Final Rate to Customer</p>
                <p className="mt-0.5 font-mono font-black text-sm text-[var(--color-maroon)]">
                  {formatMoney(finalPrice)}
                </p>
              </div>
            </div>
          </div>

          {item.description ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Scope of Work & Notes</p>
              <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap">{item.description}</p>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50/75 px-5 py-3">
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
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
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] placeholder:text-slate-400"
  const labelClass = "text-[11px] font-bold uppercase tracking-wider text-slate-600"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <form
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col"
        onSubmit={handleSubmit}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/75 px-5 py-3.5 sticky top-0 z-10">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              {isEditing ? "Modify Service Rate" : "New Service Rate"}
            </span>
            <h2 className="mt-0.5 text-base font-black text-slate-900 leading-tight">
              {isEditing ? "Edit Service Rate" : "Add Service Rate to Catalog"}
            </h2>
            <p className="text-xs text-slate-500">
              Configure standard repair pricing, classification, and device type.
            </p>
          </div>

          <button
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </header>

        {errorMessage ? (
          <div className="m-5 mb-0 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            <AlertCircle className="mt-0.5 shrink-0" size={15} />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <div className="p-5 space-y-4">
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Service Identification
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={`${labelClass} text-slate-700`}>Service / Repair Name *</span>
                <input
                  className={inputClass}
                  maxLength="120"
                  onChange={(event) => onChange("name", event.target.value)}
                  placeholder="e.g. Laptop Deep Cleaning & Thermal Repaste"
                  required
                  value={form.name}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Unit / Device Category *</span>
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

              <div className="sm:col-span-2">
                <span className={labelClass}>Repair Classification *</span>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  <button
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                      form.repairType === "ORDINARY_REPAIR"
                        ? "border-[var(--color-maroon)] bg-slate-50 ring-1 ring-[var(--color-maroon)]"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => onChange("repairType", "ORDINARY_REPAIR")}
                    type="button"
                  >
                    <div className="flex items-center gap-1.5 font-black text-sky-700 text-xs">
                      <Wrench size={15} className="text-sky-600" />
                      <span>Standard Repair</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      General cleaning, OS installation, storage/RAM upgrade.
                    </p>
                  </button>

                  <button
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                      form.repairType === "BOARD_LEVEL_REPAIR"
                        ? "border-purple-600 bg-purple-50/50 ring-1 ring-purple-600"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => onChange("repairType", "BOARD_LEVEL_REPAIR")}
                    type="button"
                  >
                    <div className="flex items-center gap-1.5 font-black text-purple-700 text-xs">
                      <Sparkles size={15} className="text-purple-600" />
                      <span>Board Level Repair</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Micro-soldering, shorted line tracing, IC chip replacement.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Pricing &amp; Labor Rates
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={`${labelClass} text-slate-700`}>Base Service Charge (₱) *</span>
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

            <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-3 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600">Final Standard Customer Price:</span>
              <span className="font-mono font-black text-sm text-[var(--color-maroon)]">
                {formatMoney(finalPriceNum)}
              </span>
            </div>
          </section>

          <section className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Scope of Work &amp; Status
            </h3>

            <label className="block">
              <span className={labelClass}>Description / Standard Inclusions</span>
              <textarea
                className={`${inputClass} resize-none`}
                maxLength="2000"
                onChange={(event) => onChange("description", event.target.value)}
                placeholder="Scope of work, standard inclusions, notes..."
                rows="3"
                value={form.description}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  checked={form.isQuickService}
                  className="rounded text-[var(--color-maroon)] focus:ring-[var(--color-maroon)]"
                  onChange={(event) => onChange("isQuickService", event.target.checked)}
                  type="checkbox"
                />
                <span>⚡ Quick / Express Service Template</span>
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
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>

          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50"
            disabled={isSaving}
            type="submit"
          >
            <Save size={14} />
            {isSaving ? "Saving…" : isEditing ? "Save service rate" : "Create service rate"}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/75 px-5 py-3.5">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Service Part & Material Details
            </span>
            <h2 className="mt-0.5 truncate text-base font-black text-slate-900 leading-tight">
              {item.name}
            </h2>
            <p className="text-xs font-semibold text-slate-500 font-mono">
              {item.deviceType || "General"} • Category: {item.category || "OTHER"}
            </p>
          </div>

          <button
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Part / Material Name</p>
              <p className="mt-1 font-bold text-slate-900">{item.name}</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Device Compatibility</p>
              <p className="mt-1 font-bold text-slate-900">{item.deviceType || "All Devices"}</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Category</p>
              <p className="mt-1 font-bold text-slate-900">{item.category || "OTHER"}</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</p>
              <div className="mt-1">
                <StatusPill status={item.isActive !== false ? "ACTIVE" : "INACTIVE"} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Cost & Markup Economics</p>
            <div className="grid gap-2 grid-cols-3 text-xs">
              <div className="rounded-lg bg-amber-50 p-2.5 text-center border border-amber-200/60">
                <p className="text-[10px] font-bold text-amber-800">Puhunan / Cost (₱)</p>
                <p className="mt-0.5 font-mono font-bold text-amber-950">{formatMoney(cost)}</p>
              </div>

              <div className="rounded-lg bg-emerald-50 p-2.5 text-center border border-emerald-200/60">
                <p className="text-[10px] font-bold text-emerald-800">Shop Tubo / Markup (₱)</p>
                <p className="mt-0.5 font-mono font-bold text-emerald-950">{formatMoney(markup)}</p>
              </div>

              <div className="rounded-lg bg-[var(--color-soft)] p-2.5 text-center border border-[var(--color-border)]">
                <p className="text-[10px] font-bold text-[var(--color-maroon)]">Suggested Part SRP</p>
                <p className="mt-0.5 font-mono font-black text-sm text-[var(--color-maroon)]">
                  {formatMoney(suggestedSrp)}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic mt-1">
              * Note: Sa resibo at claim stub ng customer, hindi makikita ang hiwalay na puhunan o tubo ng piyesa. Isasama ito sa kabuuang service charge kasama ang labor fee ni technician.
            </p>
          </div>

          {item.description ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/75 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Description / Specs</p>
              <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap">{item.description}</p>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50/75 px-5 py-3">
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
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

function PartEditorModal({
  errorMessage,
  form,
  isEditing,
  isSaving,
  onChange,
  onClose,
  onSave,
}) {
  if (!form) return null

  const cost = Number(form.costPrice || 0)
  const markup = Number(form.markupAmount || 0)
  const totalEstimatedPartPrice = cost + markup

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave()
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] placeholder:text-slate-400"
  const labelClass = "text-[11px] font-bold uppercase tracking-wider text-slate-600"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <form
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col"
        onSubmit={handleSubmit}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/75 px-5 py-3.5 sticky top-0 z-10">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-maroon)]">
              {isEditing ? "Modify Service Part" : "New Service Part & Material"}
            </span>
            <h2 className="mt-0.5 text-base font-black text-slate-900 leading-tight">
              {isEditing ? "Edit Part & Markup" : "Add Service Part / Replacement Screen / Material"}
            </h2>
            <p className="text-xs text-slate-500">
              Dedicated service materials catalog with shop markup calculation.
            </p>
          </div>

          <button
            className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </header>

        {errorMessage ? (
          <div className="m-5 mb-0 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            <AlertCircle className="mt-0.5 shrink-0" size={15} />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <div className="p-5 space-y-4">
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Part Identification
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={`${labelClass} text-slate-700`}>Part / Material Description *</span>
                <input
                  className={inputClass}
                  maxLength="150"
                  onChange={(event) => onChange("name", event.target.value)}
                  placeholder="e.g. Laptop 15.6 FHD 144Hz IPS Screen (30-Pin EDP)"
                  required
                  value={form.name}
                />
              </label>

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

              <label className="block">
                <span className={labelClass}>Part Category</span>
                <select
                  className={inputClass}
                  onChange={(event) => onChange("category", event.target.value)}
                  value={form.category}
                >
                  {PART_CATEGORY_PRESETS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">
                Cost Pool & Shop Markup (Puhunan at Tubo)
              </h3>
              <span className="text-[10px] font-bold text-slate-500">
                🔒 Shop Internal Only
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={`${labelClass} text-amber-800`}>Puhunan sa Piyesa (Cost Price ₱) *</span>
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
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Puhunan sa pagbili ng piyesa (hal. 5,000)
                </span>
              </label>

              <label className="block">
                <span className={`${labelClass} text-emerald-800`}>Tubo ng Shop sa Piyesa (Markup Amount ₱)</span>
                <input
                  className={`${inputClass} font-mono`}
                  min="0"
                  onChange={(event) => onChange("markupAmount", event.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={form.markupAmount}
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Porsyento/tubo ng shop sa mismong piyesa (hal. 2,500)
                </span>
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-600">Suggested Part Retail Price (SRP):</span>
                <span className="font-mono font-black text-sm text-[var(--color-maroon)]">
                  {formatMoney(totalEstimatedPartPrice)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                Kuwenta: Puhunan ({formatMoney(cost)}) + Tubo ({formatMoney(markup)}) = {formatMoney(totalEstimatedPartPrice)}
              </p>
            </div>
          </section>

          <section className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-maroon)]">
              Specifications & Status
            </h3>

            <label className="block">
              <span className={labelClass}>Specifications / Compatibility Notes</span>
              <textarea
                className={`${inputClass} resize-none`}
                maxLength="2000"
                onChange={(event) => onChange("description", event.target.value)}
                placeholder="Pin count, resolution, compatible models, part numbers..."
                rows="3"
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
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/75 px-5 py-3">
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>

          <button
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50"
            disabled={isSaving}
            type="submit"
          >
            <Save size={14} />
            {isSaving ? "Saving…" : isEditing ? "Save Service Part" : "Create Service Part"}
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

    const payload = {
      name: partForm.name.trim(),
      deviceType: partForm.deviceType?.trim() || "LAPTOP",
      category: partForm.category || "SCREEN",
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
      if (partsCategoryFilter && item.category !== partsCategoryFilter) return false
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
    <div className="space-y-6">
      {/* Header section matching ItemsPage */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-text-strong)]">
            Services &amp; Parts Maintenance
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Manage standard repair rates, technician fees, service parts (LCD, ICs, batteries), and shop mark-up economics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            aria-label="Refresh catalog list"
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
            disabled={activeTab === "LABOR" ? isLoading : isPartsLoading}
            onClick={activeTab === "LABOR" ? fetchCatalog : fetchPartsCatalog}
            type="button"
          >
            <RefreshCw className={(activeTab === "LABOR" ? isLoading : isPartsLoading) ? "animate-spin" : ""} size={16} />
            Refresh
          </button>

          {canManageCatalog ? (
            activeTab === "LABOR" ? (
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-maroon-hover)]"
                onClick={openNewService}
                type="button"
              >
                <Plus size={16} />
                New Service Rate
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-maroon-hover)]"
                onClick={openNewPart}
                type="button"
              >
                <Plus size={16} />
                New Service Part & Markup
              </button>
            )
          ) : null}
        </div>
      </div>

      {/* Primary Tab Switcher */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition cursor-pointer ${
            activeTab === "LABOR"
              ? "bg-[var(--color-maroon)] text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
          onClick={() => setActiveTab("LABOR")}
          type="button"
        >
          <Wrench size={15} />
          <span>Labor &amp; Service Rates</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            activeTab === "LABOR" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
          }`}>
            {catalogItems.length}
          </span>
        </button>

        <button
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition cursor-pointer ${
            activeTab === "PARTS"
              ? "bg-[var(--color-maroon)] text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
          onClick={() => setActiveTab("PARTS")}
          type="button"
        >
          <Layers size={15} />
          <span>Service Parts &amp; Markup (Piyesa at Tubo)</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            activeTab === "PARTS" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
          }`}>
            {partsCatalogItems.length}
          </span>
        </button>
      </div>

      {activeTab === "LABOR" ? (
        /* TAB 1: LABOR CATALOG */
        <>
          {/* Filter Section Card */}
          <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3">
                <Search className="text-[var(--color-muted)]" size={18} />
                <input
                  className="w-full bg-transparent text-sm font-semibold text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-muted)]"
                  onChange={(event) => {
                    setSearchText(event.target.value)
                    setPage(1)
                  }}
                  placeholder="Search service name, unit type, or scope..."
                  value={searchText}
                />
                {searchText ? (
                  <button
                    className="text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
                    onClick={() => {
                      setSearchText("")
                      setPage(1)
                    }}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              <button
                className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
                onClick={clearFilters}
                type="button"
              >
                Clear filters
              </button>
            </div>

            {/* Unit / Device Category Quick Filter Pills */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Layers size={13} className="text-[var(--color-maroon)]" />
                  Quick Filter by Device Category:
                </span>
                {deviceFilter ? (
                  <button
                    className="text-[11px] font-bold text-[var(--color-maroon)] hover:underline"
                    onClick={() => {
                      setDeviceFilter("")
                      setPage(1)
                    }}
                    type="button"
                  >
                    Reset to All ({deviceFilter})
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                    !deviceFilter
                      ? "bg-[var(--color-maroon)] text-white shadow-soft"
                      : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
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
                      className={`rounded-xl border px-3 py-1.5 text-xs font-mono font-bold transition shadow-2xs ${
                        isActive
                          ? "border-[var(--color-maroon)] bg-[var(--color-maroon)] text-white shadow-soft"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      onClick={() => {
                        if (isActive) {
                          setDeviceFilter("")
                        } else {
                          setDeviceFilter(preset)
                        }
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

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Unit / Device Type
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
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
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Repair Classification
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
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
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Service Mode
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
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
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Status
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
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
            <section className="flex items-start gap-3 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <span>{errorMessage}</span>
            </section>
          ) : null}

          {/* Labor Table Section Card */}
          <section className="rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
            {isLoading ? (
              <div className="p-6 text-sm font-semibold text-[var(--color-muted)]">
                Loading service rates... Please wait.
              </div>
            ) : paginatedLaborItems.length === 0 ? (
              <div className="grid place-items-center p-8 text-center">
                <Wrench className="text-[var(--color-muted)]" size={38} />
                <p className="mt-3 font-bold text-[var(--color-text-strong)]">
                  No matching service rates found
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Try clearing the filters or add a new service rate.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <div className="table-wrapper overflow-x-auto">
                    <table className="w-full min-w-[950px] border-separate border-spacing-0 text-left text-sm">
                      <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                        <tr>
                          <th className="whitespace-nowrap px-4 py-3.5">Service Name</th>
                          <th className="whitespace-nowrap px-4 py-3.5">Unit / Device</th>
                          <th className="whitespace-nowrap px-4 py-3.5">Classification</th>
                          <th className="whitespace-nowrap px-4 py-3.5">Base Price</th>
                          <th className="whitespace-nowrap px-4 py-3.5">Markup</th>
                          <th className="whitespace-nowrap px-4 py-3.5">Final Rate</th>
                          <th className="whitespace-nowrap px-4 py-3.5">Service Mode</th>
                          <th className="whitespace-nowrap px-4 py-3.5">Status</th>
                          <th className="whitespace-nowrap px-4 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[var(--color-border)]">
                        {paginatedLaborItems.map((item) => {
                          const isBoard = item.repairType === "BOARD_LEVEL_REPAIR"
                          const basePrice = Number(item.basePrice || 0)
                          const markup = Number(item.markupPercent || 0)
                          const finalPrice = basePrice + basePrice * (markup / 100)

                          return (
                            <tr key={item.id} className="align-top transition hover:bg-[var(--color-soft)]">
                              <td className="min-w-[220px] px-4 py-4">
                                <p className="font-bold text-[var(--color-text-strong)]">
                                  {item.name}
                                </p>
                                {item.description ? (
                                  <p className="mt-1 text-xs text-[var(--color-muted)] line-clamp-1">
                                    {item.description}
                                  </p>
                                ) : null}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4 font-semibold text-[var(--color-text-strong)]">
                                {item.deviceType || "General"}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                    isBoard
                                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                                      : "bg-sky-50 text-sky-700 border border-sky-200"
                                  }`}
                                >
                                  {isBoard ? "🔬 Board Level" : "🔧 Standard"}
                                </span>
                              </td>

                              <td className="whitespace-nowrap px-4 py-4 font-mono font-semibold text-[var(--color-text-strong)]">
                                {formatMoney(basePrice)}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4 font-mono text-[var(--color-muted)]">
                                {markup}%
                              </td>

                              <td className="whitespace-nowrap px-4 py-4 font-mono font-black text-[var(--color-maroon)]">
                                {formatMoney(finalPrice)}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4 text-xs">
                                {item.isQuickService ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-bold text-amber-800 border border-amber-200">
                                    <Zap size={12} /> Quick
                                  </span>
                                ) : (
                                  <span className="text-[var(--color-muted)]">Standard</span>
                                )}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4">
                                <StatusPill status={item.isActive !== false ? "ACTIVE" : "INACTIVE"} />
                              </td>

                              <td className="whitespace-nowrap px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    className="rounded-xl border border-[var(--color-border)] bg-white p-2 text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] cursor-pointer"
                                    onClick={() => setDetailItem(item)}
                                    title="View details"
                                    type="button"
                                  >
                                    <Eye size={15} />
                                  </button>

                                  {canManageCatalog ? (
                                    <>
                                      <button
                                        className="rounded-xl border border-[#7A1F2B] bg-white p-2 text-[#7A1F2B] transition hover:bg-[#F4F1EC] cursor-pointer"
                                        onClick={() => openServiceEditor(item)}
                                        title="Edit rate"
                                        type="button"
                                      >
                                        <Edit3 size={15} />
                                      </button>

                                      <button
                                        className="rounded-xl border border-rose-200 bg-white p-2 text-rose-600 transition hover:bg-rose-50 cursor-pointer"
                                        disabled={deletingId === item.id}
                                        onClick={() => handleDeleteService(item)}
                                        title="Delete rate"
                                        type="button"
                                      >
                                        {deletingId === item.id ? (
                                          <LoaderCircle className="animate-spin" size={15} />
                                        ) : (
                                          <Trash2 size={15} />
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
                <div className="grid gap-3 p-4 lg:hidden">
                  {paginatedLaborItems.map((item) => {
                    const isBoard = item.repairType === "BOARD_LEVEL_REPAIR"
                    const basePrice = Number(item.basePrice || 0)
                    const markup = Number(item.markupPercent || 0)
                    const finalPrice = basePrice + basePrice * (markup / 100)

                    return (
                      <article
                        className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-card"
                        key={item.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="font-bold text-[var(--color-text-strong)]">
                              {item.name}
                            </h2>
                            <p className="mt-1 text-xs text-[var(--color-muted)]">
                              {item.deviceType} • {isBoard ? "Board Level" : "Standard"}
                            </p>
                          </div>

                          <StatusPill status={item.isActive !== false ? "ACTIVE" : "INACTIVE"} />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="font-bold text-[var(--color-muted)]">Base Price</p>
                            <p className="font-bold font-mono text-[var(--color-text-strong)]">
                              {formatMoney(basePrice)}
                            </p>
                          </div>

                          <div>
                            <p className="font-bold text-[var(--color-muted)]">Final Rate</p>
                            <p className="font-black font-mono text-[var(--color-maroon)]">
                              {formatMoney(finalPrice)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-bold text-[var(--color-muted)]">
                            {isBoard ? "🔬 Board Level" : "🔧 Standard"}
                          </span>
                          {item.isQuickService ? (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                              ⚡ Quick Service
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <button
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--color-border)] bg-white py-2.5 text-xs font-bold text-[var(--color-text-strong)]"
                            onClick={() => setDetailItem(item)}
                            type="button"
                          >
                            <Eye size={14} /> View
                          </button>

                          {canManageCatalog ? (
                            <button
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[#7A1F2B] bg-white py-2.5 text-xs font-bold text-[#7A1F2B]"
                              onClick={() => openServiceEditor(item)}
                              type="button"
                            >
                              <Edit3 size={14} /> Edit
                            </button>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                </div>

                {/* Labor Pagination Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-6 py-4">
                  <span className="text-xs font-bold text-[var(--color-muted)]">
                    Showing {paginatedLaborItems.length} of {totalLaborItems} service rates
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] disabled:opacity-40"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      type="button"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-bold text-[var(--color-text-strong)]">
                      {page} of {totalLaborPages}
                    </span>
                    <button
                      className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] disabled:opacity-40"
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
          <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3">
                <Search className="text-[var(--color-muted)]" size={18} />
                <input
                  className="w-full bg-transparent text-sm font-semibold text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-muted)]"
                  onChange={(event) => {
                    setPartsSearchText(event.target.value)
                    setPartsPage(1)
                  }}
                  placeholder="Search replacement part (e.g. LCD Screen, IC chip, battery, fan)..."
                  value={partsSearchText}
                />
                {partsSearchText ? (
                  <button
                    className="text-[var(--color-muted)] hover:text-[var(--color-text-strong)]"
                    onClick={() => {
                      setPartsSearchText("")
                      setPartsPage(1)
                    }}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              <button
                className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
                onClick={clearPartsFilters}
                type="button"
              >
                Clear filters
              </button>
            </div>

            {/* Quick Filter by Category */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Layers size={13} className="text-[var(--color-maroon)]" />
                  Quick Filter by Part Category:
                </span>
                {partsCategoryFilter ? (
                  <button
                    className="text-[11px] font-bold text-[var(--color-maroon)] hover:underline"
                    onClick={() => {
                      setPartsCategoryFilter("")
                      setPartsPage(1)
                    }}
                    type="button"
                  >
                    Reset to All ({partsCategoryFilter})
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                    !partsCategoryFilter
                      ? "bg-[var(--color-maroon)] text-white shadow-soft"
                      : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => {
                    setPartsCategoryFilter("")
                    setPartsPage(1)
                  }}
                  type="button"
                >
                  All Categories
                </button>

                {PART_CATEGORY_PRESETS.map((cat) => {
                  const isActive = partsCategoryFilter === cat
                  return (
                    <button
                      key={cat}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-mono font-bold transition shadow-2xs ${
                        isActive
                          ? "border-[var(--color-maroon)] bg-[var(--color-maroon)] text-white shadow-soft"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      onClick={() => {
                        if (isActive) {
                          setPartsCategoryFilter("")
                        } else {
                          setPartsCategoryFilter(cat)
                        }
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

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Device Compatibility
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
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
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Part Category
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
                  onChange={(event) => {
                    setPartsCategoryFilter(event.target.value)
                    setPartsPage(1)
                  }}
                  value={partsCategoryFilter}
                >
                  <option value="">All categories</option>
                  {PART_CATEGORY_PRESETS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Status
                </span>
                <select
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
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
            <section className="flex items-start gap-3 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold leading-6 text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <span>{partsErrorMessage}</span>
            </section>
          ) : null}

          {/* Parts Table Section Card */}
          <section className="rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
            {isPartsLoading ? (
              <div className="p-6 text-sm font-semibold text-[var(--color-muted)]">
                Loading service parts catalog... Please wait.
              </div>
            ) : paginatedPartsItems.length === 0 ? (
              <div className="grid place-items-center p-8 text-center">
                <Layers className="text-[var(--color-muted)]" size={38} />
                <p className="mt-3 font-bold text-[var(--color-text-strong)]">
                  No matching service parts found
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Add replacement screens, chips, or materials to your catalog.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <div className="table-wrapper overflow-x-auto">
                    <table className="w-full min-w-[950px] border-separate border-spacing-0 text-left text-sm">
                      <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                        <tr>
                          <th className="whitespace-nowrap px-4 py-3.5">Part / Material Name</th>
                          <th className="whitespace-nowrap px-4 py-3.5">Device</th>
                          <th className="whitespace-nowrap px-4 py-3.5">Category</th>
                          <th className="whitespace-nowrap px-4 py-3.5 text-amber-900">Puhunan / Cost (₱)</th>
                          <th className="whitespace-nowrap px-4 py-3.5 text-emerald-900">Shop Tubo / Markup (₱)</th>
                          <th className="whitespace-nowrap px-4 py-3.5">Suggested Part SRP</th>
                          <th className="whitespace-nowrap px-4 py-3.5">Status</th>
                          <th className="whitespace-nowrap px-4 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[var(--color-border)]">
                        {paginatedPartsItems.map((item) => {
                          const cost = Number(item.costPrice || 0)
                          const markup = Number(item.markupAmount || 0)
                          const suggestedSrp = cost + markup

                          return (
                            <tr key={item.id} className="align-top transition hover:bg-[var(--color-soft)]">
                              <td className="min-w-[240px] px-4 py-4">
                                <p className="font-bold text-[var(--color-text-strong)]">
                                  {item.name}
                                </p>
                                {item.description ? (
                                  <p className="mt-1 text-xs text-[var(--color-muted)] line-clamp-1">
                                    {item.description}
                                  </p>
                                ) : null}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4 font-semibold text-[var(--color-text-strong)]">
                                {item.deviceType || "General"}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4">
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 border border-slate-200">
                                  {item.category || "OTHER"}
                                </span>
                              </td>

                              <td className="whitespace-nowrap px-4 py-4 font-mono font-bold text-amber-950">
                                {formatMoney(cost)}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4 font-mono font-bold text-emerald-950">
                                +{formatMoney(markup)}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4 font-mono font-black text-[var(--color-maroon)]">
                                {formatMoney(suggestedSrp)}
                              </td>

                              <td className="whitespace-nowrap px-4 py-4">
                                <StatusPill status={item.isActive !== false ? "ACTIVE" : "INACTIVE"} />
                              </td>

                              <td className="whitespace-nowrap px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    className="rounded-xl border border-[var(--color-border)] bg-white p-2 text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] cursor-pointer"
                                    onClick={() => setDetailPartItem(item)}
                                    title="View part details"
                                    type="button"
                                  >
                                    <Eye size={15} />
                                  </button>

                                  {canManageCatalog ? (
                                    <>
                                      <button
                                        className="rounded-xl border border-[#7A1F2B] bg-white p-2 text-[#7A1F2B] transition hover:bg-[#F4F1EC] cursor-pointer"
                                        onClick={() => openPartEditor(item)}
                                        title="Edit part"
                                        type="button"
                                      >
                                        <Edit3 size={15} />
                                      </button>

                                      <button
                                        className="rounded-xl border border-rose-200 bg-white p-2 text-rose-600 transition hover:bg-rose-50 cursor-pointer"
                                        disabled={deletingPartId === item.id}
                                        onClick={() => handleDeletePart(item)}
                                        title="Delete part"
                                        type="button"
                                      >
                                        {deletingPartId === item.id ? (
                                          <LoaderCircle className="animate-spin" size={15} />
                                        ) : (
                                          <Trash2 size={15} />
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
                <div className="grid gap-3 p-4 lg:hidden">
                  {paginatedPartsItems.map((item) => {
                    const cost = Number(item.costPrice || 0)
                    const markup = Number(item.markupAmount || 0)
                    const suggestedSrp = cost + markup

                    return (
                      <article
                        className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-card"
                        key={item.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h2 className="font-bold text-[var(--color-text-strong)]">
                              {item.name}
                            </h2>
                            <p className="mt-1 text-xs text-[var(--color-muted)]">
                              {item.deviceType} • {item.category}
                            </p>
                          </div>

                          <StatusPill status={item.isActive !== false ? "ACTIVE" : "INACTIVE"} />
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="font-bold text-[var(--color-muted)]">Puhunan</p>
                            <p className="font-bold font-mono text-amber-950">
                              {formatMoney(cost)}
                            </p>
                          </div>

                          <div>
                            <p className="font-bold text-[var(--color-muted)]">Shop Tubo</p>
                            <p className="font-bold font-mono text-emerald-950">
                              +{formatMoney(markup)}
                            </p>
                          </div>

                          <div>
                            <p className="font-bold text-[var(--color-muted)]">Suggested SRP</p>
                            <p className="font-black font-mono text-[var(--color-maroon)]">
                              {formatMoney(suggestedSrp)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <button
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--color-border)] bg-white py-2.5 text-xs font-bold text-[var(--color-text-strong)] cursor-pointer"
                            onClick={() => setDetailPartItem(item)}
                            type="button"
                          >
                            <Eye size={14} /> View
                          </button>

                          {canManageCatalog ? (
                            <button
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[#7A1F2B] bg-white py-2.5 text-xs font-bold text-[#7A1F2B] cursor-pointer"
                              onClick={() => openPartEditor(item)}
                              type="button"
                            >
                              <Edit3 size={14} /> Edit
                            </button>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                </div>

                {/* Parts Pagination Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-6 py-4">
                  <span className="text-xs font-bold text-[var(--color-muted)]">
                    Showing {paginatedPartsItems.length} of {totalPartsItems} service parts
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] disabled:opacity-40"
                      disabled={partsPage <= 1}
                      onClick={() => setPartsPage((p) => p - 1)}
                      type="button"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-bold text-[var(--color-text-strong)]">
                      {partsPage} of {totalPartsPages}
                    </span>
                    <button
                      className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] disabled:opacity-40"
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
          errorMessage={partEditorError}
          form={partForm}
          isEditing={Boolean(editingPartItem?.id)}
          isSaving={isSavingPart}
          onChange={updatePartForm}
          onClose={closePartEditor}
          onSave={savePart}
        />
      ) : null}
    </div>
  )
}
