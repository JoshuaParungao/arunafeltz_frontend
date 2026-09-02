import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Edit3, PackageSearch, Plus, RefreshCw, Save, Search, X } from "lucide-react"
import { useCallback } from "react"

import { USER_ROLES } from "../../constants/roles"
import { createItem, getItemCategories, getItems, getUnits, updateItemById } from "../../features/items/items.api"

const OWNER_ROLES = new Set([
  USER_ROLES.SUPER_OWNER,
  USER_ROLES.BRANCH_OWNER,
  USER_ROLES.ADMIN,
])

const PRICE_FIELDS = [
  { key: "price1", label: "Price 1" },
  { key: "price2", label: "Price 2" },
  { key: "price3", label: "Price 3" },
  { key: "price4", label: "Price 4" },
  { key: "price5", label: "Price 5" },
]

export function parseItemWarranty(item) {
  if (!item) return "1 YEAR WARRANTY"
  if (item.warrantyDuration) return item.warrantyDuration
  
  if (item.id) {
    try {
      const stored = localStorage.getItem(`item_warranty_${item.id}`)
      if (stored) return stored
    } catch {}
  }

  if (item.description) {
    const match = item.description.match(/\[WARRANTY:\s*([^\]]+)\]/i)
    if (match?.[1]) return match[1].trim()
  }

  if (item.hasWarranty === false && !item.isSerialized) {
    return "NO WARRANTY"
  }

  return item.isSerialized ? "1 YEAR WARRANTY" : (item.hasWarranty ? "1 YEAR WARRANTY" : "1 MONTH WARRANTY")
}

export function stripWarrantyTag(description) {
  if (!description) return ""
  return description.replace(/\[WARRANTY:\s*[^\]]+\]/gi, "").trim()
}

const EMPTY_ITEM_FORM = {
  itemCode: "",
  barcode: "",
  itemName: "",
  description: "",
  brand: "",
  modelName: "",
  categoryId: "",
  unitId: "",
  isSerialized: false,
  hasWarranty: true,
  warrantyDuration: "1 YEAR WARRANTY",
  status: "ACTIVE",
  costPrice: "0",
  price1: "0",
  price2: "0",
  price3: "0",
  price4: "0",
  price5: "0",
  minimumStock: "0",
  reorderLevel: "0",
}

function itemToForm(item) {
  if (!item) {
    return { ...EMPTY_ITEM_FORM }
  }

  const warranty = parseItemWarranty(item)

  return {
    itemCode: item.itemCode || "",
    barcode: item.barcode || "",
    itemName: item.itemName || "",
    description: stripWarrantyTag(item.description),
    brand: item.brand || "",
    modelName: item.modelName || "",
    categoryId: item.category?.id || item.categoryId || "",
    unitId: item.unit?.id || item.unitId || "",
    isSerialized: Boolean(item.isSerialized),
    hasWarranty: warranty !== "NO WARRANTY",
    warrantyDuration: warranty,
    status: item.status || "ACTIVE",
    costPrice: String(item.costPrice ?? 0),
    price1: String(item.price1 ?? 0),
    price2: String(item.price2 ?? 0),
    price3: String(item.price3 ?? 0),
    price4: String(item.price4 ?? 0),
    price5: String(item.price5 ?? 0),
    minimumStock: String(item.minimumStock ?? 0),
    reorderLevel: String(item.reorderLevel ?? 0),
  }
}

function getItemApiError(error, fallback) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    fallback
  )
}

function formatMoney(value) {
  const amount = Number(value || 0)

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount)
}

function formatFlag(value, yesLabel, noLabel) {
  return value ? yesLabel : noLabel
}

function StatusPill({ status }) {
  const label = status || "ACTIVE"

  return (
    <span className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
      {label}
    </span>
  )
}

function ItemDetailModal({ canViewCost, item, onClose }) {
  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--color-accent)]">Item details</p>
            <h2 className="mt-1 truncate text-xl font-bold text-[var(--color-text-strong)]">
              {item.itemName}
            </h2>
            <p className="mt-1 text-sm font-semibold text-[var(--color-muted)]">
              {item.itemCode}
            </p>
          </div>

          <button
            className="rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm font-bold text-[var(--color-muted)] transition hover:bg-[var(--color-soft)]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[var(--color-soft)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Item Code</p>
            <p className="mt-2 break-all font-bold text-[var(--color-text-strong)]">
              {item.itemCode || "—"}
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--color-soft)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Barcode</p>
            <p className="mt-2 break-all font-bold text-[var(--color-text-strong)]">
              {item.barcode || "No barcode"}
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--color-soft)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Brand / Model</p>
            <p className="mt-2 font-bold text-[var(--color-text-strong)]">
              {[item.brand, item.modelName].filter(Boolean).join(" • ") || "No brand/model"}
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--color-soft)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Branch</p>
            <p className="mt-2 font-bold text-[var(--color-text-strong)]">
              {item.branch?.code || item.branch?.name || "No branch"}
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--color-soft)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Category</p>
            <p className="mt-2 font-bold text-[var(--color-text-strong)]">
              {item.category?.name || "No category"}
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--color-soft)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Unit</p>
            <p className="mt-2 font-bold text-[var(--color-text-strong)]">
              {item.unit?.name || "No unit"}
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--color-soft)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Tracking</p>
            <p className="mt-2 font-bold text-[var(--color-text-strong)]">
              {item.isSerialized ? "Serialized" : "Non-serialized"}
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--color-soft)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Warranty Coverage</p>
            <p className="mt-2 font-bold text-emerald-800">
              {parseItemWarranty(item)}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--color-border)] p-4">
          <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Selling prices</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PRICE_FIELDS.map((priceField) => (
              <div key={priceField.key} className="rounded-2xl bg-[var(--color-soft)] p-3">
                <p className="text-xs font-bold text-[var(--color-muted)]">{priceField.label}</p>
                <p className="mt-1 font-bold text-[var(--color-text-strong)]">
                  {formatMoney(item[priceField.key])}
                </p>
              </div>
            ))}
          </div>
        </div>

        {canViewCost ? (
          <div className="mt-4 rounded-2xl bg-[var(--color-soft)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Cost</p>
            <p className="mt-2 font-bold text-[var(--color-text-strong)]">
              {formatMoney(item.costPrice)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
function ItemEditorModal({
  categories,
  errorMessage,
  form,
  isEditing,
  isSaving,
  onChange,
  onClose,
  onSave,
  units,
}) {
  if (!form) return null

  const inputClass =
    "mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/50 px-3 py-5 sm:px-6">
      <form
        className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          onSave()
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] p-5 sm:p-6">
          <div>
            <p className="text-sm font-bold text-[var(--color-accent)]">
              Item Catalog
            </p>

            <h2 className="mt-1 text-xl font-black text-[var(--color-text-strong)]">
              {isEditing ? "Edit item" : "New item"}
            </h2>

            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Item Code is the internal SKU. Barcode is the product scanning code.
            </p>
          </div>

          <button
            className="rounded-2xl border border-[var(--color-border)] p-2 text-[var(--color-muted)]"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-6 p-5 sm:p-6">
          {errorMessage ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <section>
            <h3 className="font-black text-[var(--color-text-strong)]">
              Product identity
            </h3>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-bold">Item Code</span>

                <input
                  className={inputClass}
                  onChange={(event) =>
                    onChange("itemCode", event.target.value.toUpperCase())
                  }
                  placeholder={
                    isEditing
                      ? "Item Code"
                      : "Auto-generated by system (e.g. 00001)"
                  }
                  value={form.itemCode}
                />

                <span className="mt-1 block text-xs text-[var(--color-muted)]">
                  System auto-generates a 5-digit number if left blank.
                </span>
              </label>

              <label>
                <span className="text-sm font-bold">Barcode</span>

                <input
                  autoComplete="off"
                  className={inputClass}
                  onChange={(event) =>
                    onChange("barcode", event.target.value)
                  }
                  placeholder="Scan or type barcode"
                  value={form.barcode}
                />

                <span className="mt-1 block text-xs text-[var(--color-muted)]">
                  Product barcode for fast scanning.
                </span>
              </label>

              <label className="md:col-span-2">
                <span className="text-sm font-bold">Product Name</span>

                <input
                  className={inputClass}
                  onChange={(event) =>
                    onChange("itemName", event.target.value)
                  }
                  required
                  value={form.itemName}
                />
              </label>

              <label>
                <span className="text-sm font-bold">Brand</span>

                <input
                  className={inputClass}
                  onChange={(event) =>
                    onChange("brand", event.target.value)
                  }
                  value={form.brand}
                />
              </label>

              <label>
                <span className="text-sm font-bold">Model</span>

                <input
                  className={inputClass}
                  onChange={(event) =>
                    onChange("modelName", event.target.value)
                  }
                  value={form.modelName}
                />
              </label>

              <label className="md:col-span-2">
                <span className="text-sm font-bold">Description</span>

                <textarea
                  className={`${inputClass} min-h-24`}
                  onChange={(event) =>
                    onChange("description", event.target.value)
                  }
                  value={form.description}
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="font-black text-[var(--color-text-strong)]">
              Classification
            </h3>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-bold">Category</span>

                <select
                  className={inputClass}
                  onChange={(event) =>
                    onChange("categoryId", event.target.value)
                  }
                  required
                  value={form.categoryId}
                >
                  <option value="">Select category</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-sm font-bold">Unit</span>

                <select
                  className={inputClass}
                  onChange={(event) =>
                    onChange("unitId", event.target.value)
                  }
                  required
                  value={form.unitId}
                >
                  <option value="">Select unit</option>

                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] p-4">
                <input
                  checked={form.isSerialized}
                  onChange={(event) =>
                    onChange("isSerialized", event.target.checked)
                  }
                  type="checkbox"
                />

                <span>
                  <strong className="block text-sm">Serialized item</strong>
                  <span className="text-xs text-[var(--color-muted)]">
                    Receiving will require unique serial numbers.
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] p-4">
                <input
                  checked={form.hasWarranty}
                  onChange={(event) => {
                    const checked = event.target.checked
                    onChange("hasWarranty", checked)
                    if (!checked) {
                      onChange("warrantyDuration", "NO WARRANTY")
                    } else if (form.warrantyDuration === "NO WARRANTY") {
                      onChange("warrantyDuration", "1 YEAR WARRANTY")
                    }
                  }}
                  type="checkbox"
                />

                <span>
                  <strong className="block text-sm">Warranty tracking</strong>
                  <span className="text-xs text-[var(--color-muted)]">
                    Enable warranty workflow for this item.
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)]/50 p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <label className="text-sm font-bold text-[var(--color-text-strong)] flex items-center gap-2">
                  <span>🛡️ Warranty Coverage</span>
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { label: "1 Year", duration: "1 YEAR WARRANTY" },
                    { label: "2 Years", duration: "2 YEARS WARRANTY" },
                    { label: "6 Months", duration: "6 MONTHS WARRANTY" },
                    { label: "1 Month", duration: "1 MONTH WARRANTY" },
                    { label: "7 Days", duration: "7 DAYS REPLACEMENT" },
                    { label: "No Warranty", duration: "NO WARRANTY" },
                  ].map((preset) => (
                    <button
                      key={preset.duration}
                      type="button"
                      onClick={() => {
                        onChange("warrantyDuration", preset.duration)
                        onChange("hasWarranty", preset.duration !== "NO WARRANTY")
                      }}
                      className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                        (form.warrantyDuration || "").trim().toUpperCase() === preset.duration
                          ? "bg-[#7A1F2B] text-white shadow-xs"
                          : "bg-white text-[var(--color-text-strong)] hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                className={`${inputClass} bg-white`}
                placeholder="e.g. 1 YEAR WARRANTY, 3 YEARS DISTRO WARRANTY, etc."
                value={form.warrantyDuration || ""}
                onChange={(event) => {
                  const val = event.target.value
                  onChange("warrantyDuration", val)
                  onChange("hasWarranty", val.trim().toUpperCase() !== "NO WARRANTY" && Boolean(val.trim()))
                }}
              />
              <p className="mt-1.5 text-xs text-[var(--color-muted)]">
                This warranty coverage will be automatically used and displayed whenever this product is added in POS Cashiering.
              </p>
            </div>

            {isEditing ? (
              <label className="mt-4 block max-w-sm">
                <span className="text-sm font-bold">Status</span>

                <select
                  className={inputClass}
                  onChange={(event) =>
                    onChange("status", event.target.value)
                  }
                  value={form.status}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
            ) : null}
          </section>

          <section>
            <h3 className="font-black text-[var(--color-text-strong)]">
              Prices
            </h3>

            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label>
                <span className="text-sm font-bold">Cost Price</span>

                <input
                  className={inputClass}
                  min="0"
                  onChange={(event) =>
                    onChange("costPrice", event.target.value)
                  }
                  step="0.01"
                  type="number"
                  value={form.costPrice}
                />
              </label>

              {PRICE_FIELDS.map((field) => (
                <label key={field.key}>
                  <span className="text-sm font-bold">
                    {field.label}
                  </span>

                  <input
                    className={inputClass}
                    min="0"
                    onChange={(event) =>
                      onChange(field.key, event.target.value)
                    }
                    step="0.01"
                    type="number"
                    value={form[field.key]}
                  />
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-black text-[var(--color-text-strong)]">
              Stock thresholds
            </h3>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-bold">Minimum Stock</span>

                <input
                  className={inputClass}
                  min="0"
                  onChange={(event) =>
                    onChange("minimumStock", event.target.value)
                  }
                  step="0.01"
                  type="number"
                  value={form.minimumStock}
                />
              </label>

              <label>
                <span className="text-sm font-bold">Reorder Level</span>

                <input
                  className={inputClass}
                  min="0"
                  onChange={(event) =>
                    onChange("reorderLevel", event.target.value)
                  }
                  step="0.01"
                  type="number"
                  value={form.reorderLevel}
                />
              </label>
            </div>
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] p-5 sm:flex-row sm:justify-end">
          <button
            className="rounded-2xl border border-[var(--color-border)] px-5 py-3 text-sm font-bold"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>

          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#7A1F2B] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            disabled={isSaving}
            type="submit"
          >
            <Save size={16} />
            {isSaving
              ? "Saving..."
              : isEditing
                ? "Save item"
                : "Create item"}
          </button>
        </footer>
      </form>
    </div>
  )
}

function PriceEditorModal({
  errorMessage,
  item,
  onChangePrice,
  onClose,
  onSave,
  priceForm,
  isSaving,
}) {
  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-6">
      <section className="w-full max-w-2xl rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] p-5">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--color-accent)]">Edit selling prices</p>
            <h2 className="mt-1 truncate text-xl font-bold text-[var(--color-text-strong)]">
              {item.itemName}
            </h2>
            <p className="mt-1 text-sm font-semibold text-[var(--color-muted)]">
              {item.itemCode}
            </p>
          </div>

          <button
            className="rounded-2xl border border-[var(--color-border)] p-2 text-[var(--color-muted)] transition hover:bg-[var(--color-soft)]"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {errorMessage ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {PRICE_FIELDS.map((field) => (
              <label className="block" key={field.key}>
                <span className="text-sm font-bold text-[var(--color-text-strong)]">
                  {field.label}
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
                  min="0"
                  onChange={(event) => onChangePrice(field.key, event.target.value)}
                  step="any"
                  type="number"
                  value={priceForm[field.key]}
                />
              </label>
            ))}
          </div>

          <p className="rounded-2xl bg-[var(--color-soft)] p-4 text-sm leading-6 text-[var(--color-muted)]">
            This updates selling prices only. Cost and stock details are not changed here.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] p-5 sm:flex-row sm:justify-end">
          <button
            className="rounded-2xl border border-[var(--color-border)] bg-white px-5 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>

          <button
            className="rounded-2xl bg-[#7A1F2B] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#641824] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            onClick={onSave}
            type="button"
          >
            {isSaving ? "Saving..." : "Save prices"}
          </button>
        </div>
      </section>
    </div>
  )
}

function ItemMobileCard({ canManagePrices, canViewCost, item, onEditPrices }) {
  return (
    <article className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-[var(--color-text-strong)]">
            {item.itemName}
          </p>
          <p className="mt-1 text-xs font-bold text-[var(--color-muted)]">
            {item.itemCode}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {[item.brand, item.modelName].filter(Boolean).join(" • ") || "No brand/model"}
          </p>
        </div>

        <StatusPill status={item.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-[var(--color-soft)] p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
            Branch
          </p>
          <p className="mt-1 font-bold text-[var(--color-text-strong)]">
            {item.branch?.code || "—"}
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
            Unit
          </p>
          <p className="mt-1 font-bold text-[var(--color-text-strong)]">
            {item.unit?.name || "—"}
          </p>
        </div>

        <div className="col-span-2 rounded-2xl bg-[var(--color-soft)] p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
            Category
          </p>
          <p className="mt-1 font-bold text-[var(--color-text-strong)]">
            {item.category?.name || "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {PRICE_FIELDS.map((field) => (
          <div key={field.key}>
            <p className="text-xs font-bold text-[var(--color-muted)]">{field.label}</p>
            <p className="font-bold text-[var(--color-text-strong)]">
              {formatMoney(item[field.key])}
            </p>
          </div>
        ))}

        {canViewCost ? (
          <div>
            <p className="text-xs font-bold text-[var(--color-muted)]">Cost</p>
            <p className="font-bold text-[var(--color-text-strong)]">
              {formatMoney(item.costPrice)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-bold text-[var(--color-muted)]">
          {formatFlag(item.isSerialized, "Serialized", "Non-serialized")}
        </span>
        <span className="rounded-full bg-[var(--color-soft)] px-3 py-1 text-xs font-bold text-[var(--color-muted)]">
          {formatFlag(item.hasWarranty, "With warranty", "No warranty")}
        </span>
      </div>

      {canManagePrices ? (
        <button
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#7A1F2B] bg-white px-4 py-3 text-sm font-bold text-[#7A1F2B] transition hover:bg-[#F4F1EC]"
          onClick={() => onEditPrices(item)}
          type="button"
        >
          <Edit3 size={16} />
          Edit prices
        </button>
      ) : null}
    </article>
  )
}

function ItemsPage({ selectedBranch, user }) {
  const selectedBranchId = selectedBranch?.id
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState(null)
  const [searchText, setSearchText] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [serializedFilter, setSerializedFilter] = useState("")
  const [warrantyFilter, setWarrantyFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [unitFilter, setUnitFilter] = useState("")
  const [categoryOptions, setCategoryOptions] = useState([])
  const [unitOptions, setUnitOptions] = useState([])
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [selectedItem, setSelectedItem] = useState(null)
  const [detailItem, setDetailItem] = useState(null)
  const [priceForm, setPriceForm] = useState({
    price1: "",
    price2: "",
    price3: "",
    price4: "",
    price5: "",
  })
  const [priceErrorMessage, setPriceErrorMessage] = useState("")
  const [isSavingPrices, setIsSavingPrices] = useState(false)

  const [editingItem, setEditingItem] = useState(undefined)
  const [itemForm, setItemForm] = useState(null)
  const [itemEditorError, setItemEditorError] = useState("")
  const [isSavingItem, setIsSavingItem] = useState(false)

  const canManageCatalog = useMemo(() => OWNER_ROLES.has(user?.role), [user?.role])
  const canManagePrices = canManageCatalog
  const canViewCost = canManageCatalog

  const loadFilterOptions = useCallback(async () => {
    try {
      const categoryParams = {
        limit: 100,
      }

      if (selectedBranchId) {
        categoryParams.branchId = selectedBranchId
      }

      const [categoriesResponse, unitsResponse] = await Promise.all([
        getItemCategories(categoryParams),
        getUnits({ limit: 100 }),
      ])

      const categories = categoriesResponse?.data?.items
      const units = unitsResponse?.data?.items

      setCategoryOptions(Array.isArray(categories) ? categories : [])
      setUnitOptions(Array.isArray(units) ? units : [])
    } catch {
      setCategoryOptions([])
      setUnitOptions([])
    }
  }, [selectedBranchId])
  const loadItems = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const params = {
        page,
        limit: pageSize,
      }

      if (searchText.trim()) {
        params.search = searchText.trim()
      }

      if (selectedBranchId) {
        params.branchId = selectedBranchId
      }

      if (statusFilter) {
        params.status = statusFilter
      }

      if (serializedFilter) {
        params.isSerialized = serializedFilter
      }

      if (warrantyFilter) {
        params.hasWarranty = warrantyFilter
      }

      if (categoryFilter) {
        params.categoryId = categoryFilter
      }

      if (unitFilter) {
        params.unitId = unitFilter
      }

      const response = await getItems(params)
      const result = response?.data || {}

      setItems(Array.isArray(result.items) ? result.items : [])
      setPagination(result.pagination || null)
    } catch {
      setErrorMessage("Unable to load items right now. Please refresh and try again.")
      setItems([])
      setPagination(null)
    } finally {
      setIsLoading(false)
    }
  }, [categoryFilter, page, pageSize, searchText, selectedBranchId, serializedFilter, statusFilter, unitFilter, warrantyFilter])

  const openDetailModal = (item) => {
    setDetailItem(item)
  }

  const closeDetailModal = () => {
    setDetailItem(null)
  }

  const clearFilters = () => {
    setSearchText("")
    setCategoryFilter("")
    setUnitFilter("")
    setStatusFilter("")
    setSerializedFilter("")
    setWarrantyFilter("")
    setPage(1)
  }

  const openNewItem = () => {
    setEditingItem(null)
    setItemEditorError("")
    setItemForm({ ...EMPTY_ITEM_FORM })
  }

  const openItemEditor = (item) => {
    setEditingItem(item)
    setItemEditorError("")
    setItemForm(itemToForm(item))
  }

  const closeItemEditor = () => {
    if (isSavingItem) return

    setEditingItem(undefined)
    setItemForm(null)
    setItemEditorError("")
  }

  const updateItemForm = (field, value) => {
    setItemForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const saveItem = async () => {
    if (!itemForm || isSavingItem) return

    if (!itemForm.itemName.trim()) {
      setItemEditorError("Product Name is required.")
      return
    }

    if (!itemForm.categoryId) {
      setItemEditorError("Category is required.")
      return
    }

    if (!itemForm.unitId) {
      setItemEditorError("Unit is required.")
      return
    }

    setIsSavingItem(true)
    setItemEditorError("")

    const cleanDesc = stripWarrantyTag(itemForm.description)
    const warrantyStr = (itemForm.warrantyDuration || "1 YEAR WARRANTY").trim()
    const packagedDesc = warrantyStr
      ? (cleanDesc ? `${cleanDesc} [WARRANTY: ${warrantyStr}]` : `[WARRANTY: ${warrantyStr}]`)
      : (cleanDesc || null)

    const payload = {
      ...(itemForm.itemCode.trim()
        ? { itemCode: itemForm.itemCode.trim().toUpperCase() }
        : {}),
      itemName: itemForm.itemName.trim(),
      description: packagedDesc,
      barcode: itemForm.barcode.trim() || null,
      brand: itemForm.brand.trim() || null,
      modelName: itemForm.modelName.trim() || null,
      categoryId: itemForm.categoryId,
      unitId: itemForm.unitId,
      isSerialized: Boolean(itemForm.isSerialized),
      hasWarranty: warrantyStr !== "NO WARRANTY" && Boolean(warrantyStr),
      costPrice: numberValue(itemForm.costPrice),
      price1: numberValue(itemForm.price1),
      price2: numberValue(itemForm.price2),
      price3: numberValue(itemForm.price3),
      price4: numberValue(itemForm.price4),
      price5: numberValue(itemForm.price5),
      minimumStock: numberValue(itemForm.minimumStock),
      reorderLevel: numberValue(itemForm.reorderLevel),
    }

    try {
      let response

      if (editingItem?.id) {
        response = await updateItemById(editingItem.id, {
          ...payload,
          status: itemForm.status,
        })
      } else {
        response = await createItem({
          ...payload,
          ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
        })
      }

      const savedItem = response?.data

      if (!response?.success || !savedItem) {
        throw new Error("Invalid item response.")
      }

      if (savedItem?.id && warrantyStr) {
        try {
          localStorage.setItem(`item_warranty_${savedItem.id}`, warrantyStr)
        } catch {}
      }

      setItemForm(null)
      setEditingItem(undefined)
      await loadItems()
    } catch (error) {
      setItemEditorError(
        getItemApiError(
          error,
          editingItem?.id
            ? "Unable to update this item."
            : "Unable to create this item.",
        ),
      )
    } finally {
      setIsSavingItem(false)
    }
  }
  const openPriceEditor = (item) => {
    setSelectedItem(item)
    setPriceErrorMessage("")
    setPriceForm({
      price1: String(item.price1 ?? ""),
      price2: String(item.price2 ?? ""),
      price3: String(item.price3 ?? ""),
      price4: String(item.price4 ?? ""),
      price5: String(item.price5 ?? ""),
    })
  }

  const closePriceEditor = () => {
    if (isSavingPrices) return

    setSelectedItem(null)
    setPriceErrorMessage("")
  }

  const handlePriceChange = (field, value) => {
    setPriceForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const savePrices = async () => {
    if (!selectedItem) return

    setIsSavingPrices(true)
    setPriceErrorMessage("")

    try {
      const payload = {
        price1: Number(priceForm.price1 || 0),
        price2: Number(priceForm.price2 || 0),
        price3: Number(priceForm.price3 || 0),
        price4: Number(priceForm.price4 || 0),
        price5: Number(priceForm.price5 || 0),
      }

      const response = await updateItemById(selectedItem.id, payload)
      const updatedItem = response?.data

      if (!response?.success || !updatedItem) {
        throw new Error("Unable to save prices.")
      }

      setItems((currentItems) =>
        currentItems.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
      )
      setSelectedItem(null)
    } catch {
      setPriceErrorMessage("Unable to save prices. Please check the values and try again.")
    } finally {
      setIsSavingPrices(false)
    }
  }

  useEffect(() => {
    // Branch changes intentionally reset branch-specific filters and pagination.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCategoryFilter("")
    setPage(1)
    loadFilterOptions()
  }, [loadFilterOptions])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadItems()
    }, 300)

    return () => window.clearTimeout(timer)
  }, [loadItems])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-accent)]">
            Item Catalog
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text-strong)]">
            Product catalog
          </h1>
          <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
            View item details, selling prices, category, unit, and branch assignment.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManageCatalog ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-4 py-3 text-sm font-bold text-white shadow-sm"
              onClick={openNewItem}
              type="button"
            >
              <Plus size={17} />
              New item
            </button>
          ) : null}

          <button
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)]"
            onClick={loadItems}
            type="button"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <section className="rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
              size={18}
            />
            <input
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] py-3 pl-11 pr-4 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
              onChange={(event) => {
                setSearchText(event.target.value)
                setPage(1)
              }}
              placeholder="Scan barcode / Search Item Code / Product Name"
              value={searchText}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
              {pagination?.totalItems ?? items.length} item(s)
            </div>

            <button
              className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
              Category
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
              onChange={(event) => {
                setCategoryFilter(event.target.value)
                setPage(1)
              }}
              value={categoryFilter}
            >
              <option value="">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
              Unit
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
              onChange={(event) => {
                setUnitFilter(event.target.value)
                setPage(1)
              }}
              value={unitFilter}
            >
              <option value="">All units</option>
              {unitOptions.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
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

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
              Tracking
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
              onChange={(event) => {
                setSerializedFilter(event.target.value)
                setPage(1)
              }}
              value={serializedFilter}
            >
              <option value="">All tracking</option>
              <option value="true">Serialized</option>
              <option value="false">Non-serialized</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
              Warranty
            </span>
            <select
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white"
              onChange={(event) => {
                setWarrantyFilter(event.target.value)
                setPage(1)
              }}
              value={warrantyFilter}
            >
              <option value="">All warranty</option>
              <option value="true">With warranty</option>
              <option value="false">No warranty</option>
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

      <section className="rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        {isLoading ? (
          <div className="p-6 text-sm font-semibold text-[var(--color-muted)]">
            Loading items... Please wait.
          </div>
        ) : items.length === 0 ? (
          <div className="grid place-items-center p-8 text-center">
            <PackageSearch className="text-[var(--color-muted)]" size={38} />
            <p className="mt-3 font-bold text-[var(--color-text-strong)]">
              No matching items found
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Try clearing the filters or changing your search.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <div className="table-wrapper">
                <table className="w-full min-w-[1250px] border-separate border-spacing-0 text-left text-sm">
                  <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-3">Item</th>
                      <th className="whitespace-nowrap px-3 py-3">Branch</th>
                      <th className="whitespace-nowrap px-3 py-3">Category</th>
                      <th className="whitespace-nowrap px-3 py-3">Unit</th>
                      <th className="whitespace-nowrap px-3 py-3">Price 1</th>
                      <th className="whitespace-nowrap px-3 py-3">Price 2</th>
                      <th className="whitespace-nowrap px-3 py-3">Price 3</th>
                      <th className="whitespace-nowrap px-3 py-3">Price 4</th>
                      <th className="whitespace-nowrap px-3 py-3">Price 5</th>
                      {canViewCost ? <th className="whitespace-nowrap px-3 py-3">Cost</th> : null}
                      <th className="whitespace-nowrap px-3 py-3">Tracking</th>
                      <th className="whitespace-nowrap px-3 py-3">Status</th>
                      <th className="whitespace-nowrap px-3 py-3">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[var(--color-border)]">
                    {items.map((item) => (
                      <tr key={item.id} className="align-top transition hover:bg-[var(--color-soft)]">
                        <td className="min-w-[220px] px-3 py-4">
                          <p className="font-bold text-[var(--color-text-strong)]">
                            {item.itemName}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
                            {item.itemCode}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-muted)]">
                            {[item.brand, item.modelName].filter(Boolean).join(" • ") || "No brand/model"}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 font-semibold text-[var(--color-text-strong)]">
                          {item.branch?.code || "—"}
                        </td>

                        <td className="min-w-[140px] px-3 py-4 text-[var(--color-muted)]">
                          {item.category?.name || "—"}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 text-[var(--color-muted)]">
                          {item.unit?.name || "—"}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 font-semibold text-[var(--color-text-strong)]">
                          {formatMoney(item.price1)}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 font-semibold text-[var(--color-text-strong)]">
                          {formatMoney(item.price2)}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 font-semibold text-[var(--color-text-strong)]">
                          {formatMoney(item.price3)}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 font-semibold text-[var(--color-text-strong)]">
                          {formatMoney(item.price4)}
                        </td>

                        <td className="whitespace-nowrap px-3 py-4 font-semibold text-[var(--color-text-strong)]">
                          {formatMoney(item.price5)}
                        </td>

                        {canViewCost ? (
                          <td className="whitespace-nowrap px-3 py-4 font-semibold text-[var(--color-text-strong)]">
                            {formatMoney(item.costPrice)}
                          </td>
                        ) : null}

                        <td className="min-w-[120px] px-3 py-4 text-xs font-semibold leading-6 text-[var(--color-muted)]">
                          <p>{formatFlag(item.isSerialized, "Serialized", "Non-serialized")}</p>
                          <p>{formatFlag(item.hasWarranty, "With warranty", "No warranty")}</p>
                        </td>

                        <td className="whitespace-nowrap px-3 py-4">
                          <StatusPill status={item.status} />
                        </td>

                        <td className="whitespace-nowrap px-3 py-4">
                          <div className="flex flex-col gap-2">
                            <button
                              className="inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
                              onClick={() => openDetailModal(item)}
                              type="button"
                            >
                              View details
                            </button>

                            {canManageCatalog ? (
                              <button
                                className="inline-flex items-center justify-center gap-1 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)]"
                                onClick={() => openItemEditor(item)}
                                type="button"
                              >
                                <Edit3 size={14} />
                                Edit item
                              </button>
                            ) : null}

                            {canManagePrices ? (
                              <button
                                className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#7A1F2B] bg-white px-3 py-2 text-xs font-bold text-[#7A1F2B] transition hover:bg-[#F4F1EC]"
                                onClick={() => openPriceEditor(item)}
                                type="button"
                              >
                                <Edit3 size={14} />
                                Edit prices
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 p-4 lg:hidden">
              {items.map((item) => (
                <ItemMobileCard
                  canManagePrices={canManagePrices}
                  canViewCost={canViewCost}
                  item={item}
                  key={item.id}
                  onEditPrices={openPriceEditor}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {pagination ? (
        <section className="flex flex-col gap-3 rounded-3xl border border-[var(--color-border)] bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-[var(--color-muted)]">
            Page {pagination.page} of {pagination.totalPages} • {pagination.totalItems} item(s)
          </div>

          <div className="flex gap-3">
            <button
              className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!pagination.hasPreviousPage || isLoading}
              onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
              type="button"
            >
              Previous
            </button>

            <button
              className="rounded-2xl border border-[#7A1F2B] bg-white px-4 py-3 text-sm font-bold text-[#7A1F2B] transition hover:bg-[#F4F1EC] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!pagination.hasNextPage || isLoading}
              onClick={() => setPage((currentPage) => currentPage + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </section>
      ) : null}

      <ItemEditorModal
        categories={categoryOptions}
        errorMessage={itemEditorError}
        form={itemForm}
        isEditing={Boolean(editingItem?.id)}
        isSaving={isSavingItem}
        onChange={updateItemForm}
        onClose={closeItemEditor}
        onSave={saveItem}
        units={unitOptions}
      />

      <ItemDetailModal
        canViewCost={canViewCost}
        item={detailItem}
        onClose={closeDetailModal}
      />
      <PriceEditorModal
        errorMessage={priceErrorMessage}
        isSaving={isSavingPrices}
        item={selectedItem}
        onChangePrice={handlePriceChange}
        onClose={closePriceEditor}
        onSave={savePrices}
        priceForm={priceForm}
      />
    </div>
  )
}

export default ItemsPage



























