import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Box,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Layers,
  LoaderCircle,
  Plus,
  RefreshCw,
  Ruler,
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
import {
  createUnit,
  getUnits,
  updateUnitById,
} from "../../features/units/units.api"

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

const DEFAULT_STANDARD_PARTS_CATEGORIES = [
  { categoryCode: "CAT-CPU", name: "CPU / Processor", description: "Processors and CPUs (Intel, AMD)." },
  { categoryCode: "CAT-MOBO", name: "Motherboard", description: "Motherboards across form factors (ATX, mATX, ITX)." },
  { categoryCode: "CAT-RAM", name: "RAM / Memory", description: "DDR4, DDR5 desktop and laptop memory modules." },
  { categoryCode: "CAT-GPU", name: "GPU / Graphics Card", description: "Dedicated graphics cards and video display adapters." },
  { categoryCode: "CAT-STORAGE", name: "Storage", description: "NVMe M.2 SSDs, SATA SSDs, and hard disk drives." },
  { categoryCode: "CAT-PSU", name: "Power Supply", description: "Power supply units (PSU) and modular power cables." },
  { categoryCode: "CAT-CASE", name: "PC Case / Chassis", description: "Computer chassis, gaming cases, and tower enclosures." },
  { categoryCode: "CAT-COOLING", name: "Cooling & Fans", description: "AIO liquid coolers, CPU air coolers, case fans, thermal paste." },
  { categoryCode: "CAT-MONITOR", name: "Monitor / Display", description: "PC monitors, gaming displays, and panel screens." },
  { categoryCode: "CAT-PERIPHERALS", name: "Peripherals", description: "Keyboards, mice, headsets, webcams, desk pads." },
  { categoryCode: "CAT-ACCESSORIES", name: "Accessories", description: "Adapters, extension cords, brackets, and accessories." },
  { categoryCode: "CAT-NETWORKING", name: "Networking", description: "Wi-Fi adapters, routers, switches, and patch cords." },
]

const DEFAULT_STANDARD_UNITS = [
  { unitCode: "BOX", name: "Box", description: "Unit for boxed items or packaged boxes." },
  { unitCode: "KIT", name: "Kit", description: "Unit for kits, combo packages, or modular toolkits." },
  { unitCode: "METER", name: "Meter", description: "Unit for cables and items measured by length." },
  { unitCode: "PAIR", name: "Pair", description: "Unit for paired items." },
  { unitCode: "PIECE", name: "Piece", description: "Individual product or item count." },
  { unitCode: "ROLL", name: "Roll", description: "Unit for rolled cables, tape, or tubing." },
  { unitCode: "SET", name: "Set", description: "Unit for bundled items or complete sets." },
  { unitCode: "UNIT", name: "Unit", description: "Standard discrete unit / equipment." },
]

export default function CategoriesPage({ selectedBranch, user }) {
  const [activeTab, setActiveTab] = useState("categories") // "categories" | "units"

  // Category State
  const [categories, setCategories] = useState([])
  const [catPagination, setCatPagination] = useState({
    page: 1,
    limit: 15,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  })

  // Unit State
  const [units, setUnits] = useState([])
  const [unitPagination, setUnitPagination] = useState({
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

  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [catForm, setCatForm] = useState({
    name: "",
    categoryCode: "",
    description: "",
    status: "ACTIVE",
    parentId: "",
    attributeSchema: [],
  })
  const [newSpecName, setNewSpecName] = useState("")
  const [newSpecSuggestions, setNewSpecSuggestions] = useState("")

  // Unit Modal State
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState(null)
  const [unitForm, setUnitForm] = useState({
    name: "",
    unitCode: "",
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

  // Load Categories
  const loadCategories = useCallback(
    async (page = 1) => {
      setIsLoading(true)
      setErrorMessage("")
      try {
        const params = {
          page: String(page),
          limit: "50",
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        }

        const response = await getItemCategories(params)
        const data = response?.data || response

        if (Array.isArray(data?.items)) {
          setCategories(data.items)
          if (data.pagination) {
            setCatPagination(data.pagination)
          }
        } else if (Array.isArray(data)) {
          setCategories(data)
          setCatPagination((prev) => ({
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

  // Load Units
  const loadUnits = useCallback(
    async (page = 1) => {
      setIsLoading(true)
      setErrorMessage("")
      try {
        const params = {
          page: String(page),
          limit: "25",
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        }

        const response = await getUnits(params)
        const data = response?.data || response

        if (Array.isArray(data?.items)) {
          setUnits(data.items)
          if (data.pagination) {
            setUnitPagination(data.pagination)
          }
        } else if (Array.isArray(data)) {
          setUnits(data)
          setUnitPagination((prev) => ({
            ...prev,
            totalItems: data.length,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          }))
        } else {
          setUnits([])
        }
      } catch (err) {
        console.error("Failed to load units:", err)
        setErrorMessage(
          err?.response?.data?.message ||
            err?.message ||
            "Unable to load units of measure. Please try again."
        )
      } finally {
        setIsLoading(false)
      }
    },
    [debouncedSearch, statusFilter]
  )

  useEffect(() => {
    if (activeTab === "categories") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadCategories(1)
    } else {
      loadUnits(1)
    }
  }, [activeTab, loadCategories, loadUnits])

  // Category Modal Handlers
  const handleOpenCreateCategoryModal = () => {
    setEditingCategory(null)
    setCatForm({
      name: "",
      categoryCode: "",
      description: "",
      status: "ACTIVE",
      parentId: "",
      attributeSchema: [],
    })
    setNewSpecName("")
    setNewSpecSuggestions("")
    setFormError("")
    setIsCatModalOpen(true)
  }

  const handleOpenEditCategoryModal = (category) => {
    setEditingCategory(category)
    setCatForm({
      name: category.name || "",
      categoryCode: category.categoryCode || "",
      description: category.description || "",
      status: category.status || "ACTIVE",
      parentId: category.parentId || "",
      attributeSchema: Array.isArray(category.attributeSchema)
        ? JSON.parse(JSON.stringify(category.attributeSchema))
        : [],
    })
    setNewSpecName("")
    setNewSpecSuggestions("")
    setFormError("")
    setIsCatModalOpen(true)
  }

  const handleAddSpecField = () => {
    if (!newSpecName.trim()) return
    const trimmedName = newSpecName.trim()
    const currentSpecs = Array.isArray(catForm.attributeSchema) ? [...catForm.attributeSchema] : []
    if (currentSpecs.some((s) => s.name.toLowerCase() === trimmedName.toLowerCase())) {
      setFormError(`Specification "${trimmedName}" is already defined.`)
      return
    }

    const suggestions = newSpecSuggestions
      ? newSpecSuggestions
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    setCatForm({
      ...catForm,
      attributeSchema: [
        ...currentSpecs,
        {
          name: trimmedName,
          type: "text",
          required: true,
          suggestions,
        },
      ],
    })
    setNewSpecName("")
    setNewSpecSuggestions("")
    setFormError("")
  }

  const handleRemoveSpecField = (indexToRemove) => {
    const currentSpecs = Array.isArray(catForm.attributeSchema) ? [...catForm.attributeSchema] : []
    setCatForm({
      ...catForm,
      attributeSchema: currentSpecs.filter((_, idx) => idx !== indexToRemove),
    })
  }

  const handleCategorySubmit = async (e) => {
    e.preventDefault()
    setFormError("")

    if (!catForm.name.trim()) {
      setFormError("Category Name is required.")
      return
    }

    setIsSaving(true)
    try {
      if (editingCategory) {
        const payload = {
          name: catForm.name.trim(),
          description: catForm.description.trim() || null,
          status: catForm.status,
          parentId: catForm.parentId || null,
          attributeSchema: catForm.attributeSchema?.length ? catForm.attributeSchema : null,
        }
        await updateItemCategoryById(editingCategory.id, payload)
        setNoticeMessage(`Category "${catForm.name.trim()}" updated successfully!`)
      } else {
        const payload = {
          name: catForm.name.trim(),
          ...(catForm.categoryCode.trim()
            ? { categoryCode: catForm.categoryCode.trim().toUpperCase() }
            : {}),
          ...(catForm.description.trim()
            ? { description: catForm.description.trim() }
            : {}),
          parentId: catForm.parentId || null,
          attributeSchema: catForm.attributeSchema?.length ? catForm.attributeSchema : null,
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        }
        await createItemCategory(payload)
        setNoticeMessage(`Category "${catForm.name.trim()}" created successfully!`)
      }

      setIsCatModalOpen(false)
      loadCategories(catPagination.page)
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

  // Unit Modal Handlers
  const handleOpenCreateUnitModal = () => {
    setEditingUnit(null)
    setUnitForm({
      name: "",
      unitCode: "",
      description: "",
      status: "ACTIVE",
    })
    setFormError("")
    setIsUnitModalOpen(true)
  }

  const handleOpenEditUnitModal = (unit) => {
    setEditingUnit(unit)
    setUnitForm({
      name: unit.name || "",
      unitCode: unit.unitCode || "",
      description: unit.description || "",
      status: unit.status || "ACTIVE",
    })
    setFormError("")
    setIsUnitModalOpen(true)
  }

  const handleUnitSubmit = async (e) => {
    e.preventDefault()
    setFormError("")

    if (!unitForm.unitCode.trim()) {
      setFormError("Unit Code is required (e.g. BOX, KIT, PIECE).")
      return
    }

    if (!unitForm.name.trim()) {
      setFormError("Unit Name is required (e.g. Box, Kit, Piece).")
      return
    }

    setIsSaving(true)
    try {
      if (editingUnit) {
        const payload = {
          unitCode: unitForm.unitCode.trim().toUpperCase(),
          name: unitForm.name.trim(),
          description: unitForm.description.trim() || null,
          status: unitForm.status,
        }
        await updateUnitById(editingUnit.id, payload)
        setNoticeMessage(`Unit "${unitForm.unitCode.trim().toUpperCase()}" updated successfully!`)
      } else {
        const payload = {
          unitCode: unitForm.unitCode.trim().toUpperCase(),
          name: unitForm.name.trim(),
          description: unitForm.description.trim() || null,
        }
        await createUnit(payload)
        setNoticeMessage(`Unit "${unitForm.unitCode.trim().toUpperCase()}" created successfully!`)
      }

      setIsUnitModalOpen(false)
      loadUnits(unitPagination.page)
      setTimeout(() => setNoticeMessage(""), 4000)
    } catch (err) {
      console.error("Save unit error:", err)
      setFormError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save unit of measure. Please check if code already exists."
      )
    } finally {
      setIsSaving(false)
    }
  }

  // Quick Preset Unit Seed Handler
  const handleQuickAddStandardUnit = async (preset) => {
    setIsSaving(true)
    try {
      await createUnit({
        unitCode: preset.unitCode,
        name: preset.name,
        description: preset.description,
      })
      setNoticeMessage(`Unit "${preset.unitCode}" added successfully!`)
      loadUnits(unitPagination.page)
      setTimeout(() => setNoticeMessage(""), 4000)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || ""
      if (msg.includes("already exists") || msg.includes("ALREADY_EXISTS")) {
        setNoticeMessage(`Unit "${preset.unitCode}" already exists in the system.`)
      } else {
        setErrorMessage(msg || "Failed to add preset unit.")
      }
      setTimeout(() => setNoticeMessage(""), 4000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleQuickAddStandardCategory = async (preset) => {
    setIsSaving(true)
    try {
      await createItemCategory({
        name: preset.name,
        categoryCode: preset.categoryCode,
        description: preset.description,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      })
      setNoticeMessage(`Category "${preset.name}" added successfully!`)
      loadCategories(catPagination.page)
      setTimeout(() => setNoticeMessage(""), 4000)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || ""
      if (msg.includes("already exists") || msg.includes("ALREADY_EXISTS")) {
        setNoticeMessage(`Category "${preset.name}" already exists in the catalog.`)
      } else {
        setErrorMessage(msg || "Failed to add preset category.")
      }
      setTimeout(() => setNoticeMessage(""), 4000)
    } finally {
      setIsSaving(false)
    }
  }

  const existingCategoryCodes = useMemo(() => {
    return new Set(categories.map((c) => String(c.categoryCode || "").toUpperCase()))
  }, [categories])

  const existingUnitCodes = useMemo(() => {
    return new Set(units.map((u) => String(u.unitCode || "").toUpperCase()))
  }, [units])

  const availableParentCategories = useMemo(() => {
    return categories.filter(
      (c) => (!c.parentId || c.parentId === "") && c.id !== editingCategory?.id
    )
  }, [categories, editingCategory])

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
            {activeTab === "categories" ? "Product Categories" : "Units of Measure"}
          </h1>
          <p className="text-xs text-[var(--color-muted)] sm:text-sm">
            {activeTab === "categories"
              ? "Manage 2-tier inventory classifications (Category ➔ Subcategory) and specification attribute templates."
              : "Manage units of measurement (BOX, KIT, METER, PAIR, PIECE, ROLL, SET, UNIT) for inventory items."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-soft transition hover:bg-slate-50 disabled:opacity-50"
            disabled={isLoading}
            onClick={() => (activeTab === "categories" ? loadCategories(catPagination.page) : loadUnits(unitPagination.page))}
            title="Refresh list"
            type="button"
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} size={14} />
            Refresh
          </button>
          {activeTab === "categories" ? (
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-4 py-2.5 text-xs font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)]"
              onClick={handleOpenCreateCategoryModal}
              type="button"
            >
              <Plus size={15} />
              Add Category
            </button>
          ) : (
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-maroon)] px-4 py-2.5 text-xs font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)]"
              onClick={handleOpenCreateUnitModal}
              type="button"
            >
              <Plus size={15} />
              Add Unit
            </button>
          )}
        </div>
      </header>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          className={`inline-flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-black transition ${
            activeTab === "categories"
              ? "border-[var(--color-maroon)] text-[var(--color-maroon)]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
          onClick={() => {
            setActiveTab("categories")
            setSearchQuery("")
            setStatusFilter("ALL")
          }}
          type="button"
        >
          <Tag size={15} />
          Product Categories
          {categories.length > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {catPagination.totalItems || categories.length}
            </span>
          ) : null}
        </button>

        <button
          className={`inline-flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-black transition ${
            activeTab === "units"
              ? "border-[var(--color-maroon)] text-[var(--color-maroon)]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
          onClick={() => {
            setActiveTab("units")
            setSearchQuery("")
            setStatusFilter("ALL")
          }}
          type="button"
        >
          <Ruler size={15} />
          Units of Measure
          {units.length > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {unitPagination.totalItems || units.length}
            </span>
          ) : null}
        </button>
      </div>

      {/* Notice Message */}
      {noticeMessage ? (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{noticeMessage}</span>
          </div>
          <button
            onClick={() => setNoticeMessage("")}
            className="text-emerald-600 hover:text-emerald-800"
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Error Message */}
      {errorMessage ? (
        <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage("")}
            className="text-red-600 hover:text-red-800"
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Quick Presets for Categories */}
      {activeTab === "categories" ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Box size={14} className="text-[var(--color-maroon)]" />
              Quick Filter by Standard Category:
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Click a pill to filter catalog categories
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                !searchQuery
                  ? "bg-[var(--color-maroon)] text-white shadow-soft"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              onClick={() => setSearchQuery("")}
              type="button"
            >
              All Categories
            </button>

            {DEFAULT_STANDARD_PARTS_CATEGORIES.map((preset) => {
              const isActiveFilter = searchQuery.trim().toLowerCase() === preset.name.toLowerCase()
              const isRegistered =
                existingCategoryCodes.has(preset.categoryCode) ||
                categories.some((c) => c.name?.toLowerCase() === preset.name.toLowerCase())

              return (
                <button
                  key={preset.categoryCode}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                    isActiveFilter
                      ? "border-[var(--color-maroon)] bg-[var(--color-maroon)] text-white shadow-soft"
                      : isRegistered
                        ? "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                        : "border-dashed border-amber-300 bg-amber-50/80 text-amber-800 hover:bg-amber-100"
                  }`}
                  onClick={() => {
                    if (isActiveFilter) {
                      setSearchQuery("")
                    } else {
                      setSearchQuery(preset.name)
                    }
                  }}
                  title={`Filter by ${preset.name}`}
                  type="button"
                >
                  <span>{preset.name}</span>
                  {!isRegistered ? (
                    <span
                      className="rounded bg-amber-200 px-1 text-[9px] font-bold text-amber-900"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleQuickAddStandardCategory(preset)
                      }}
                      title="Click to register this parts category"
                    >
                      + Add
                    </span>
                  ) : (
                    <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Quick Presets & Filter Pills for Unit of Measure */}
      {activeTab === "units" ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Ruler size={14} className="text-[var(--color-maroon)]" />
              Quick Filter by Standard Unit:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-medium">
                8 Standard Units Supported
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                !searchQuery
                  ? "bg-[var(--color-maroon)] text-white shadow-soft"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              onClick={() => setSearchQuery("")}
              type="button"
            >
              All Units
            </button>

            {DEFAULT_STANDARD_UNITS.map((preset) => {
              const isActiveFilter = searchQuery.trim().toUpperCase() === preset.unitCode
              const isRegistered = existingUnitCodes.has(preset.unitCode)

              return (
                <button
                  key={preset.unitCode}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-mono font-bold transition shadow-2xs ${
                    isActiveFilter
                      ? "border-[var(--color-maroon)] bg-[var(--color-maroon)] text-white shadow-soft"
                      : isRegistered
                        ? "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                        : "border-dashed border-amber-300 bg-amber-50/80 text-amber-800 hover:bg-amber-100"
                  }`}
                  onClick={() => {
                    if (isActiveFilter) {
                      setSearchQuery("")
                    } else {
                      setSearchQuery(preset.unitCode)
                    }
                  }}
                  title={`Filter by ${preset.unitCode} (${preset.name})`}
                  type="button"
                >
                  <span>{preset.unitCode}</span>
                  <span
                    className={`font-sans text-[10px] font-normal ${
                      isActiveFilter ? "text-white/80" : "text-slate-500"
                    }`}
                  >
                    ({preset.name})
                  </span>
                  {!isRegistered ? (
                    <span
                      className="rounded bg-amber-200 px-1 text-[9px] font-bold text-amber-900"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleQuickAddStandardUnit(preset)
                      }}
                      title="Click to register this unit"
                    >
                      + Add
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Search & Filter Bar */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-xs font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--color-maroon)] focus:bg-white focus:ring-1 focus:ring-[var(--color-maroon)]"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === "categories"
                ? "Search category name or code..."
                : "Search unit code (e.g. BOX, KIT, METER) or name..."
            }
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
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  statusFilter === status
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setStatusFilter(status)}
                type="button"
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Table: Categories or Units */}
      {activeTab === "categories" ? (
        <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Category Code</th>
                  <th className="px-5 py-3.5">Category Name</th>
                  <th className="px-5 py-3.5">Classification</th>
                  <th className="px-5 py-3.5">Specifications Template</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Created</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
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
                    <td colSpan={8} className="py-12 text-center">
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
                  categories.map((cat) => {
                    const hasSpecs = Array.isArray(cat.attributeSchema) && cat.attributeSchema.length > 0
                    return (
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
                        <td className="px-5 py-3.5">
                          {cat.parent ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
                              ↳ Subcategory of {cat.parent.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
                              Main Category
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {hasSpecs ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800 border border-indigo-200">
                              {cat.attributeSchema.length} specs defined
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">None</span>
                          )}
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
                            onClick={() => handleOpenEditCategoryModal(cat)}
                            title="Edit category"
                            type="button"
                          >
                            <Edit3 size={13} />
                            Edit
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {catPagination.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
              <span className="text-xs font-semibold text-slate-600">
                Page {catPagination.page} of {catPagination.totalPages} ({catPagination.totalItems} total)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-100 disabled:opacity-40"
                  disabled={!catPagination.hasPreviousPage || isLoading}
                  onClick={() => loadCategories(catPagination.page - 1)}
                  type="button"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-100 disabled:opacity-40"
                  disabled={!catPagination.hasNextPage || isLoading}
                  onClick={() => loadCategories(catPagination.page + 1)}
                  type="button"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        /* Units of Measure Table */
        <section className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Unit Code</th>
                  <th className="px-5 py-3.5">Unit Name</th>
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
                          Loading units of measure...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : units.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Ruler size={32} />
                        <p className="text-sm font-bold text-slate-700">
                          No units of measure found
                        </p>
                        <p className="text-xs text-slate-500">
                          {searchQuery || statusFilter !== "ALL"
                            ? "Try adjusting your search or filters."
                            : "Click one of the standard presets above or '+ Add Unit of Measure'."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  units.map((unit) => (
                    <tr
                      key={unit.id}
                      className="transition hover:bg-slate-50/80 group"
                    >
                      <td className="px-5 py-3.5 font-mono font-black text-slate-900">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-slate-900 border border-slate-200">
                          {unit.unitCode}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {unit.name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                        {unit.description || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                            unit.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {unit.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-500 font-mono">
                        {formatDate(unit.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:border-[var(--color-maroon)] hover:text-[var(--color-maroon)] hover:bg-slate-50"
                          onClick={() => handleOpenEditUnitModal(unit)}
                          title="Edit unit"
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

          {/* Unit Pagination Footer */}
          {unitPagination.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
              <span className="text-xs font-semibold text-slate-600">
                Page {unitPagination.page} of {unitPagination.totalPages} ({unitPagination.totalItems} total)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-100 disabled:opacity-40"
                  disabled={!unitPagination.hasPreviousPage || isLoading}
                  onClick={() => loadUnits(unitPagination.page - 1)}
                  type="button"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-100 disabled:opacity-40"
                  disabled={!unitPagination.hasNextPage || isLoading}
                  onClick={() => loadUnits(unitPagination.page + 1)}
                  type="button"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* Modal for Add / Edit Category */}
      {isCatModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
        >
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-[var(--color-maroon)]" />
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingCategory ? "Edit Category" : "Add New Category"}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Configure category hierarchy, details, and hardware specification templates
                  </p>
                </div>
              </div>
              <button
                aria-label="Close"
                className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-200"
                onClick={() => setIsCatModalOpen(false)}
                type="button"
              >
                <X size={15} />
              </button>
            </header>

            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError ? (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              ) : null}

              {/* Section 1: Classification & Details */}
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Parent Category (Classification)
                    </span>
                    <select
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                      onChange={(e) => setCatForm({ ...catForm, parentId: e.target.value })}
                      value={catForm.parentId}
                    >
                      <option value="">-- Main Category (No Parent) --</option>
                      {availableParentCategories.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.categoryCode || "No Code"})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Select a parent to make this a Subcategory (e.g. Desktop CPU under CPU / Processor)
                    </span>
                  </label>

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Category Name <span className="text-red-500">*</span>
                    </span>
                    <input
                      autoFocus
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                      onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                      placeholder="e.g. Desktop CPU, Gaming GPU, NVMe SSD"
                      required
                      type="text"
                      value={catForm.name}
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {!editingCategory ? (
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                        Category Code <span className="text-slate-400 font-normal">(Auto-generated if blank)</span>
                      </span>
                      <input
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                        onChange={(e) =>
                          setCatForm({ ...catForm, categoryCode: e.target.value })
                        }
                        placeholder="e.g. CAT-CPU-DESK"
                        type="text"
                        value={catForm.categoryCode}
                      />
                    </label>
                  ) : null}

                  {editingCategory ? (
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                        Status
                      </span>
                      <select
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                        onChange={(e) => setCatForm({ ...catForm, status: e.target.value })}
                        value={catForm.status}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </label>
                  ) : null}
                </div>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </span>
                  <textarea
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] resize-none"
                    onChange={(e) =>
                      setCatForm({ ...catForm, description: e.target.value })
                    }
                    placeholder="Additional notes or hardware details covered by this category..."
                    rows={2}
                    value={catForm.description}
                  />
                </label>
              </div>

              {/* Section 2: Specification Attributes Template */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-maroon)] flex items-center gap-1.5">
                      <Layers size={13} />
                      Specification Schema Template
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Products encoded under this category will require these technical attributes.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                    {catForm.attributeSchema?.length || 0} specifications
                  </span>
                </div>

                {/* Defined Specs List */}
                {catForm.attributeSchema?.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {catForm.attributeSchema.map((spec, idx) => (
                      <div
                        key={spec.name || idx}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-2xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{spec.name}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-600 uppercase">
                              Required
                            </span>
                          </div>
                          {spec.suggestions?.length > 0 ? (
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              Suggestions: {spec.suggestions.slice(0, 5).join(", ")}
                              {spec.suggestions.length > 5 ? ` +${spec.suggestions.length - 5} more` : ""}
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic mt-0.5">
                              Free-form text input
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecField(idx)}
                          className="rounded-lg p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Remove specification field"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-center">
                    <p className="text-xs font-semibold text-slate-600">
                      No technical specifications defined yet.
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Add specification fields below so encoders have guided attributes with auto-suggestions.
                    </p>
                  </div>
                )}

                {/* Inline Add Spec Form */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                    + Add New Specification Field
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-[var(--color-maroon)]"
                      onChange={(e) => setNewSpecName(e.target.value)}
                      placeholder="Spec Name (e.g. Socket, VRAM, Form Factor)"
                      type="text"
                      value={newSpecName}
                    />
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-[var(--color-maroon)]"
                      onChange={(e) => setNewSpecSuggestions(e.target.value)}
                      placeholder="Suggestions (comma separated: AM4, AM5, LGA1700)"
                      type="text"
                      value={newSpecSuggestions}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddSpecField}
                      disabled={!newSpecName.trim()}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1 text-xs font-bold text-white shadow-2xs hover:bg-slate-900 disabled:opacity-40 transition"
                    >
                      <Plus size={12} />
                      Add Specification
                    </button>
                  </div>
                </div>
              </div>

              <footer className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  onClick={() => setIsCatModalOpen(false)}
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

      {/* Modal for Add / Edit Unit of Measure */}
      {isUnitModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2">
                <Ruler size={18} className="text-[var(--color-maroon)]" />
                <h3 className="text-base font-black text-slate-900">
                  {editingUnit ? "Edit Unit of Measure" : "Add Unit of Measure"}
                </h3>
              </div>
              <button
                aria-label="Close"
                className="rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-200"
                onClick={() => setIsUnitModalOpen(false)}
                type="button"
              >
                <X size={15} />
              </button>
            </header>

            <form onSubmit={handleUnitSubmit} className="p-6 space-y-4">
              {formError ? (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              ) : null}

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Unit Code <span className="text-red-500">*</span>
                </span>
                <input
                  autoFocus
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                  disabled={Boolean(editingUnit)}
                  onChange={(e) =>
                    setUnitForm({ ...unitForm, unitCode: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. BOX, KIT, METER, PAIR, PIECE, ROLL, SET, UNIT"
                  required
                  type="text"
                  value={unitForm.unitCode}
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Unit Display Name <span className="text-red-500">*</span>
                </span>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                  onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                  placeholder="e.g. Box, Kit, Meter, Pair, Piece, Roll, Set, Unit"
                  required
                  type="text"
                  value={unitForm.name}
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </span>
                <textarea
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)] resize-none"
                  onChange={(e) =>
                    setUnitForm({ ...unitForm, description: e.target.value })
                  }
                  placeholder="Description of this measurement unit..."
                  rows={3}
                  value={unitForm.description}
                />
              </label>

              {editingUnit ? (
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Status
                  </span>
                  <select
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-[var(--color-maroon)] focus:ring-1 focus:ring-[var(--color-maroon)]"
                    onChange={(e) => setUnitForm({ ...unitForm, status: e.target.value })}
                    value={unitForm.status}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </label>
              ) : null}

              <footer className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  onClick={() => setIsUnitModalOpen(false)}
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
                  {editingUnit ? "Save Changes" : "Create Unit"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
