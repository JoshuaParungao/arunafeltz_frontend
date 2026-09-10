import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Layers,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Tag,
  X,
} from "lucide-react"

import { USER_ROLES } from "../../constants/roles"
import {
  createItemCategory,
  getItemCategories,
  updateItemCategoryById,
} from "../../features/categories/categories.api"

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function CategoriesPage({ selectedBranch, user }) {
  const [categories, setCategories] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [noticeMessage, setNoticeMessage] = useState("")

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [form, setForm] = useState({
    name: "",
    categoryCode: "",
    description: "",
    status: "ACTIVE",
  })
  const [formError, setFormError] = useState("")

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const effectiveBranchId = useMemo(() => {
    if (user?.role === USER_ROLES.SUPER_OWNER) {
      return selectedBranch?.id || undefined
    }
    return user?.branchId || selectedBranch?.id || undefined
  }, [user, selectedBranch])

  const loadCategories = useCallback(
    async (page = 1) => {
      setIsLoading(true)
      setErrorMessage("")
      try {
        const params = {
          page: String(page),
          limit: "15",
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        }

        const response = await getItemCategories(params)
        const data = response?.data || response

        if (Array.isArray(data?.items)) {
          setCategories(data.items)
          if (data.pagination) {
            setPagination(data.pagination)
          }
        } else if (Array.isArray(data)) {
          setCategories(data)
          setPagination((prev) => ({
            ...prev,
            totalItems: data.length,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          }))
        } else {
          setCategories([])
        }
      } catch (err) {
        console.error("Failed to load categories:", err)
        setErrorMessage(
          err?.response?.data?.message ||
            err?.message ||
            "Unable to load product categories. Please try again."
        )
      } finally {
        setIsLoading(false)
      }
    },
    [debouncedSearch, statusFilter, effectiveBranchId]
  )

  useEffect(() => {
    loadCategories(1)
  }, [loadCategories])

  const handleOpenCreateModal = () => {
    setEditingCategory(null)
    setForm({
      name: "",
      categoryCode: "",
      description: "",
      status: "ACTIVE",
    })
    setFormError("")
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (category) => {
    setEditingCategory(category)
    setForm({
      name: category.name || "",
      categoryCode: category.categoryCode || "",
      description: category.description || "",
      status: category.status || "ACTIVE",
    })
    setFormError("")
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCategory(null)
    setFormError("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError("")

    if (!form.name.trim()) {
      setFormError("Category Name is required.")
      return
    }

    setIsSaving(true)
    try {
      if (editingCategory) {
        // Update existing category
        const payload = {
          name: form.name.trim(),
          description: form.description.trim() || null,
          status: form.status,
        }
        await updateItemCategoryById(editingCategory.id, payload)
        setNoticeMessage(`Category "${form.name.trim()}" updated successfully!`)
      } else {
        // Create new category
        const payload = {
          name: form.name.trim(),
          ...(form.categoryCode.trim()
            ? { categoryCode: form.categoryCode.trim().toUpperCase() }
            : {}),
          ...(form.description.trim()
            ? { description: form.description.trim() }
            : {}),
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        }
        await createItemCategory(payload)
        setNoticeMessage(`Category "${form.name.trim()}" created successfully!`)
      }

      handleCloseModal()
      loadCategories(pagination.page)
      setTimeout(() => setNoticeMessage(""), 4000)
    } catch (err) {
      console.error("Save category error:", err)
      setFormError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save category. Please check your inputs."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <header className="flex flex-col gap-4 rounded-3xl border border-[var(--color-border)] bg-white p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700">
              <Layers size={13} className="text-[var(--color-maroon)]" />
              File Maintenance
            </span>
            {selectedBranch ? (
              <span className="inline-flex items-center rounded-full bg-amber-100/70 px-3 py-1 text-[11px] font-bold text-amber-900">
                {selectedBranch.name} ({selectedBranch.code})
              </span>
            ) : null}
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            Product Categories
          </h1>
          <p className="text-xs text-[var(--color-muted)] sm:text-sm">
            Manage inventory item classifications, groupings, and catalog categories for point of sale and reporting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-soft transition hover:bg-slate-50 disabled:opacity-50"
            disabled={isLoading}
            onClick={() => loadCategories(pagination.page)}
            title="Refresh categories"
            type="button"
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} size={14} />
            Refresh
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-4 py-2.5 text-xs font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)]"
            onClick={handleOpenCreateModal}
            type="button"
          >
            <Plus size={15} />
            Add Category
          </button>
        </div>
      </header>

      {/* Notice Message */}
      {noticeMessage ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 shadow-soft animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{noticeMessage}</span>
        </div>
      ) : null}

      {/* Error Message */}
      {errorMessage ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-800 shadow-soft">
          <AlertCircle size={16} className="shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {/* Filters Bar */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-xs font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--color-maroon)] focus:bg-white focus:ring-1 focus:ring-[var(--color-maroon)]"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search category name or code..."
            type="text"
            value={searchQuery}
          />
          {searchQuery ? (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setSearchQuery("")}
              type="button"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Status:
          </span>
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {["ALL", "ACTIVE", "INACTIVE"].map((status) => (
              <button
                key={status}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  statusFilter === status
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setStatusFilter(status)}
                type="button"
              >
                {status === "ALL"
                  ? "All"
                  : status === "ACTIVE"
                    ? "Active"
                    : "Inactive"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Table */}
      <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-5 py-3.5">Category Code</th>
                <th className="px-5 py-3.5">Category Name</th>
                <th className="px-5 py-3.5">Description</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Created</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <LoaderCircle
                        className="animate-spin text-[var(--color-maroon)]"
                        size={24}
                      />
                      <span className="text-xs font-semibold text-slate-500">
                        Loading categories...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <Tag size={32} />
                      <p className="text-sm font-bold text-slate-700">
                        No categories found
                      </p>
                      <p className="text-xs text-slate-500">
                        {searchQuery || statusFilter !== "ALL"
                          ? "Try adjusting your search or filters."
                          : "Start by clicking '+ Add Category' above."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr
                    key={cat.id}
                    className="transition hover:bg-slate-50/80 group"
                  >
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      {cat.categoryCode || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900">{cat.name}</div>
                      {cat.branch ? (
                        <div className="text-[10px] text-slate-500">
                          Branch: {cat.branch.name} ({cat.branch.code})
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                      {cat.description || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          cat.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {cat.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-500 font-mono">
                      {formatDate(cat.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:border-[var(--color-maroon)] hover:text-[var(--color-maroon)] hover:bg-slate-50"
                        onClick={() => handleOpenEditModal(cat)}
                        title="Edit category"
                        type="button"
                      >
                        <Edit3 size={13} />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
            <span className="text-xs font-semibold text-slate-600">
              Page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-100 disabled:opacity-40"
                disabled={!pagination.hasPreviousPage || isLoading}
                onClick={() => loadCategories(pagination.page - 1)}
                type="button"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-100 disabled:opacity-40"
                disabled={!pagination.hasNextPage || isLoading}
                onClick={() => loadCategories(pagination.page + 1)}
                type="button"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Modal for Add / Edit Category */}
      {isModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-[var(--color-maroon)]" />
                <h3 className="text-base font-black text-slate-900">
                  {editingCategory ? "Edit Category" : "Add New Category"}
                </h3>
              </div>
              <button
                aria-label="Close"
                className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-200"
                onClick={handleCloseModal}
                type="button"
              >
                <X size={15} />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError ? (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              ) : null}

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Category Name <span className="text-red-500">*</span>
                </span>
                <input
                  autoFocus
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Monitors, Keyboards, Liquid Coolers"
                  required
                  type="text"
                  value={form.name}
                />
              </label>

              {!editingCategory ? (
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Category Code <span className="text-slate-400 font-normal">(Optional, auto-generated if blank)</span>
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                    onChange={(e) =>
                      setForm({ ...form, categoryCode: e.target.value })
                    }
                    placeholder="e.g. CAT-MONITOR"
                    type="text"
                    value={form.categoryCode}
                  />
                </label>
              ) : null}

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </span>
                <textarea
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] resize-none"
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Additional notes or sub-types covered by this category..."
                  rows={3}
                  value={form.description}
                />
              </label>

              {editingCategory ? (
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Status
                  </span>
                  <select
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    value={form.status}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </label>
              ) : null}

              <footer className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  onClick={handleCloseModal}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-maroon)] px-5 py-2 text-xs font-bold text-white shadow-soft hover:bg-[var(--color-maroon-hover)] transition disabled:opacity-50"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? (
                    <LoaderCircle className="animate-spin" size={14} />
                  ) : null}
                  {editingCategory ? "Save Changes" : "Create Category"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
