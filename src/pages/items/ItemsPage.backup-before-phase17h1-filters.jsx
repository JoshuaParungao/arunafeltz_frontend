import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Edit3, PackageSearch, RefreshCw, Search, X } from "lucide-react"

import { USER_ROLES } from "../../constants/roles"
import { getItems, updateItemById } from "../../features/items/items.api"

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
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState(null)
  const [searchText, setSearchText] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [selectedItem, setSelectedItem] = useState(null)
  const [priceForm, setPriceForm] = useState({
    price1: "",
    price2: "",
    price3: "",
    price4: "",
    price5: "",
  })
  const [priceErrorMessage, setPriceErrorMessage] = useState("")
  const [isSavingPrices, setIsSavingPrices] = useState(false)

  const canManagePrices = useMemo(() => OWNER_ROLES.has(user?.role), [user?.role])
  const canViewCost = canManagePrices

  const loadItems = async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const params = {
        page: 1,
        limit: 50,
      }

      if (searchText.trim()) {
        params.search = searchText.trim()
      }

      if (selectedBranch?.id) {
        params.branchId = selectedBranch.id
      }

      const response = await getItems(params)
      const result = response?.data || {}

      setItems(Array.isArray(result.items) ? result.items : [])
      setPagination(result.pagination || null)
    } catch {
      setErrorMessage("Unable to load items. Please try again.")
      setItems([])
      setPagination(null)
    } finally {
      setIsLoading(false)
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
    const timer = window.setTimeout(() => {
      loadItems()
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchText, selectedBranch?.id])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-accent)]">
            Items / Catalog
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-text-strong)]">
            Product catalog
          </h1>
          <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
            View item details, selling prices, category, unit, and branch assignment.
          </p>
        </div>

        <button
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--color-text-strong)] shadow-sm transition hover:bg-[var(--color-soft)]"
          onClick={loadItems}
          type="button"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
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
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search item code, item name, brand, or model"
              value={searchText}
            />
          </div>

          <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
            {pagination?.totalItems ?? items.length} item(s)
          </div>
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
            Loading items...
          </div>
        ) : items.length === 0 ? (
          <div className="grid place-items-center p-8 text-center">
            <PackageSearch className="text-[var(--color-muted)]" size={38} />
            <p className="mt-3 font-bold text-[var(--color-text-strong)]">
              No items found
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Try another search or refresh the catalog.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <div className="table-wrapper">
                <table className="w-full min-w-[1400px] border-separate border-spacing-0 text-left text-sm">
                  <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3">Item</th>
                      <th className="whitespace-nowrap px-4 py-3">Branch</th>
                      <th className="whitespace-nowrap px-4 py-3">Category</th>
                      <th className="whitespace-nowrap px-4 py-3">Unit</th>
                      <th className="whitespace-nowrap px-4 py-3">Price 1</th>
                      <th className="whitespace-nowrap px-4 py-3">Price 2</th>
                      <th className="whitespace-nowrap px-4 py-3">Price 3</th>
                      <th className="whitespace-nowrap px-4 py-3">Price 4</th>
                      <th className="whitespace-nowrap px-4 py-3">Price 5</th>
                      {canViewCost ? <th className="whitespace-nowrap px-4 py-3">Cost</th> : null}
                      <th className="whitespace-nowrap px-4 py-3">Tracking</th>
                      <th className="whitespace-nowrap px-4 py-3">Status</th>
                      {canManagePrices ? <th className="whitespace-nowrap px-4 py-3">Action</th> : null}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[var(--color-border)]">
                    {items.map((item) => (
                      <tr key={item.id} className="align-top transition hover:bg-[var(--color-soft)]">
                        <td className="min-w-[260px] px-4 py-4">
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

                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-[var(--color-text-strong)]">
                          {item.branch?.code || "—"}
                        </td>

                        <td className="min-w-[160px] px-4 py-4 text-[var(--color-muted)]">
                          {item.category?.name || "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-[var(--color-muted)]">
                          {item.unit?.name || "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-[var(--color-text-strong)]">
                          {formatMoney(item.price1)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-[var(--color-text-strong)]">
                          {formatMoney(item.price2)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-[var(--color-text-strong)]">
                          {formatMoney(item.price3)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-[var(--color-text-strong)]">
                          {formatMoney(item.price4)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-[var(--color-text-strong)]">
                          {formatMoney(item.price5)}
                        </td>

                        {canViewCost ? (
                          <td className="whitespace-nowrap px-4 py-4 font-semibold text-[var(--color-text-strong)]">
                            {formatMoney(item.costPrice)}
                          </td>
                        ) : null}

                        <td className="min-w-[130px] px-4 py-4 text-xs font-semibold leading-6 text-[var(--color-muted)]">
                          <p>{formatFlag(item.isSerialized, "Serialized", "Non-serialized")}</p>
                          <p>{formatFlag(item.hasWarranty, "With warranty", "No warranty")}</p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <StatusPill status={item.status} />
                        </td>

                        {canManagePrices ? (
                          <td className="whitespace-nowrap px-4 py-4">
                            <button
                              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#7A1F2B] bg-white px-4 py-2 text-xs font-bold text-[#7A1F2B] transition hover:bg-[#F4F1EC]"
                              onClick={() => openPriceEditor(item)}
                              type="button"
                            >
                              <Edit3 size={14} />
                              Edit prices
                            </button>
                          </td>
                        ) : null}
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



