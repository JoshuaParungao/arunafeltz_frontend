import { useEffect, useMemo, useState } from "react"
import { AlertCircle, PackageSearch, RefreshCw, Search } from "lucide-react"

import { USER_ROLES } from "../../constants/roles"
import { getItems } from "../../features/items/items.api"

const OWNER_ROLES = new Set([
  USER_ROLES.SUPER_OWNER,
  USER_ROLES.BRANCH_OWNER,
  USER_ROLES.ADMIN,
])

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

function ItemMobileCard({ canViewCost, item }) {
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
        <div>
          <p className="text-xs font-bold text-[var(--color-muted)]">Price 1</p>
          <p className="font-bold text-[var(--color-text-strong)]">{formatMoney(item.price1)}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--color-muted)]">Price 2</p>
          <p className="font-bold text-[var(--color-text-strong)]">{formatMoney(item.price2)}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-[var(--color-muted)]">Price 3</p>
          <p className="font-bold text-[var(--color-text-strong)]">{formatMoney(item.price3)}</p>
        </div>
        {canViewCost ? (
          <div>
            <p className="text-xs font-bold text-[var(--color-muted)]">Cost</p>
            <p className="font-bold text-[var(--color-text-strong)]">{formatMoney(item.costPrice)}</p>
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
    </article>
  )
}

function ItemsPage({ selectedBranch, user }) {
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState(null)
  const [searchText, setSearchText] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  const canViewCost = useMemo(() => OWNER_ROLES.has(user?.role), [user?.role])

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
                <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
                  <thead className="bg-[var(--color-soft)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3">Item</th>
                      <th className="whitespace-nowrap px-4 py-3">Branch</th>
                      <th className="whitespace-nowrap px-4 py-3">Category</th>
                      <th className="whitespace-nowrap px-4 py-3">Unit</th>
                      <th className="whitespace-nowrap px-4 py-3">Price 1</th>
                      <th className="whitespace-nowrap px-4 py-3">Price 2</th>
                      <th className="whitespace-nowrap px-4 py-3">Price 3</th>
                      {canViewCost ? <th className="whitespace-nowrap px-4 py-3">Cost</th> : null}
                      <th className="whitespace-nowrap px-4 py-3">Tracking</th>
                      <th className="whitespace-nowrap px-4 py-3">Status</th>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 p-4 lg:hidden">
              {items.map((item) => (
                <ItemMobileCard canViewCost={canViewCost} item={item} key={item.id} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default ItemsPage
