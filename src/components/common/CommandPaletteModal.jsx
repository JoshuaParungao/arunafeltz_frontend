import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  ArrowRight,
  Barcode,
  CheckCircle2,
  FileText,
  HelpCircle,
  Layers,
  LoaderCircle,
  Package,
  Receipt,
  Search,
  Tag,
  User,
  X,
} from "lucide-react"
import { searchOmni } from "../../features/omnisearch/omnisearch.api"
import { APP_MODULES } from "../../constants/appModules"

function formatMoney(value) {
  const amount = Number(value || 0)
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function CommandPaletteModal({
  isOpen,
  onClose,
  branchId,
  allowedModules = [],
  onNavigate,
  onSelectSale,
  onSelectQuotation,
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState({
    products: [],
    serials: [],
    receipts: [],
    quotations: [],
    customers: [],
  })
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setQuery("")
      setSelectedIndex(0)
      setResults({
        products: [],
        serials: [],
        receipts: [],
        quotations: [],
        customers: [],
      })
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  // Filter modules based on query for navigation shortcuts
  const matchingModules = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return allowedModules.slice(0, 5)
    return allowedModules.filter(
      (m) =>
        m.label.toLowerCase().includes(trimmed) ||
        m.key.toLowerCase().includes(trimmed) ||
        (m.group && m.group.toLowerCase().includes(trimmed))
    ).slice(0, 4)
  }, [query, allowedModules])

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults({
        products: [],
        serials: [],
        receipts: [],
        quotations: [],
        customers: [],
      })
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const timeout = setTimeout(async () => {
      try {
        const response = await searchOmni({ q: trimmed, branchId })
        const data = response?.data || response || {}
        setResults({
          products: data.products || [],
          serials: data.serials || [],
          receipts: data.receipts || [],
          quotations: data.quotations || [],
          customers: data.customers || [],
        })
        setSelectedIndex(0)
      } catch (err) {
        console.warn("Omnisearch failed:", err)
      } finally {
        setIsLoading(false)
      }
    }, 220)

    return () => clearTimeout(timeout)
  }, [query, branchId])

  // Flatten items for keyboard navigation (Arrow Up/Down & Enter)
  const flatItems = useMemo(() => {
    const list = []

    matchingModules.forEach((m) => {
      list.push({ type: "MODULE", data: m })
    })
    results.products.forEach((p) => {
      list.push({ type: "PRODUCT", data: p })
    })
    results.serials.forEach((s) => {
      list.push({ type: "SERIAL", data: s })
    })
    results.receipts.forEach((r) => {
      list.push({ type: "RECEIPT", data: r })
    })
    results.quotations.forEach((q) => {
      list.push({ type: "QUOTATION", data: q })
    })
    results.customers.forEach((c) => {
      list.push({ type: "CUSTOMER", data: c })
    })

    return list
  }, [matchingModules, results])

  const handleSelectItem = (item) => {
    if (!item) return
    onClose()

    switch (item.type) {
      case "MODULE":
        onNavigate(item.data.key)
        break
      case "PRODUCT":
        onNavigate("items")
        break
      case "SERIAL":
        onNavigate("serials")
        break
      case "RECEIPT":
        if (onSelectSale) {
          onSelectSale(item.data)
        } else {
          onNavigate("pos")
        }
        break
      case "QUOTATION":
        if (onSelectQuotation) {
          onSelectQuotation(item.data)
        } else {
          onNavigate("quotations")
        }
        break
      case "CUSTOMER":
        onNavigate("customers")
        break
      default:
        break
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (flatItems.length === 0 ? 0 : (prev + 1) % flatItems.length))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (flatItems.length === 0 ? 0 : (prev - 1 + flatItems.length) % flatItems.length))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (flatItems[selectedIndex]) {
        handleSelectItem(flatItems[selectedIndex])
      }
    }
  }

  if (!isOpen) return null

  let globalIndexCounter = 0

  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/70 p-3 pt-12 sm:pt-20 backdrop-blur-xs"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar Input */}
        <div className="relative flex items-center border-b border-slate-200 px-4 py-3.5 sm:px-5">
          <Search className="size-5 shrink-0 text-slate-400" />
          <input
            autoFocus
            className="ml-3 min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 outline-none"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, serials, receipts, quotations, or type module name..."
            ref={inputRef}
            type="search"
            value={query}
          />
          {isLoading ? (
            <LoaderCircle className="size-5 shrink-0 animate-spin text-slate-400" />
          ) : query ? (
            <button
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={() => setQuery("")}
              type="button"
            >
              <X size={16} />
            </button>
          ) : (
            <span className="hidden items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 sm:inline-flex">
              ESC to close
            </span>
          )}
        </div>

        {/* Results Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-4 font-sans text-xs sm:p-4">
          {/* Quick Navigation Shortcuts */}
          {matchingModules.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                ⚡ Quick Navigation
              </p>
              <div className="mt-1 space-y-1">
                {matchingModules.map((m) => {
                  const currIdx = globalIndexCounter++
                  const isSelected = selectedIndex === currIdx
                  return (
                    <button
                      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition ${
                        isSelected
                          ? "bg-[#002060] text-white"
                          : "text-slate-800 hover:bg-slate-100"
                      }`}
                      key={m.key}
                      onClick={() => handleSelectItem({ type: "MODULE", data: m })}
                      type="button"
                    >
                      <div className="flex items-center gap-2.5">
                        <Layers size={16} className={isSelected ? "text-white" : "text-[#002060]"} />
                        <span className="font-bold text-sm">{m.label}</span>
                        {m.group && (
                          <span className={`text-[10px] uppercase font-semibold ${isSelected ? "text-blue-200" : "text-slate-400"}`}>
                            • {m.group}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold ${isSelected ? "text-blue-200" : "text-slate-400"}`}>
                        Jump to module <ArrowRight size={13} className="inline ml-1" />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 1. Products / Items */}
          {results.products.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                📦 Products &amp; Stock Lookup
              </p>
              <div className="mt-1 space-y-1">
                {results.products.map((item) => {
                  const currIdx = globalIndexCounter++
                  const isSelected = selectedIndex === currIdx
                  return (
                    <button
                      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition ${
                        isSelected
                          ? "bg-[#002060] text-white"
                          : "text-slate-800 hover:bg-slate-100"
                      }`}
                      key={item.id}
                      onClick={() => handleSelectItem({ type: "PRODUCT", data: item })}
                      type="button"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <Package size={16} className={isSelected ? "text-white" : "text-indigo-600"} />
                          <span className="font-bold text-sm truncate">{item.itemName}</span>
                          <span className={`font-mono text-xs px-2 py-0.5 rounded ${isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                            {item.itemCode}
                          </span>
                        </div>
                        <p className={`mt-0.5 text-xs ${isSelected ? "text-blue-100" : "text-slate-500"}`}>
                          {item.brand ? `${item.brand} • ` : ""}{item.modelName || ""}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm font-mono">{formatMoney(item.price)}</p>
                        <p className={`text-xs font-semibold ${item.stock > 0 ? (isSelected ? "text-emerald-300" : "text-emerald-600") : (isSelected ? "text-red-300" : "text-red-600")}`}>
                          {item.stock > 0 ? `${item.stock} in stock` : "Out of stock"}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 2. Serial Numbers & Barcodes */}
          {results.serials.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                🔍 Serials &amp; Barcode Lookup
              </p>
              <div className="mt-1 space-y-1">
                {results.serials.map((s) => {
                  const currIdx = globalIndexCounter++
                  const isSelected = selectedIndex === currIdx
                  const isAvailable = s.status === "AVAILABLE"
                  const isSold = s.status === "SOLD"

                  return (
                    <button
                      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition ${
                        isSelected
                          ? "bg-[#002060] text-white"
                          : "text-slate-800 hover:bg-slate-100"
                      }`}
                      key={s.id}
                      onClick={() => handleSelectItem({ type: "SERIAL", data: s })}
                      type="button"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <Barcode size={16} className={isSelected ? "text-white" : "text-slate-700"} />
                          <span className="font-mono font-bold text-sm tracking-wide">{s.serialNumber}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              isAvailable
                                ? (isSelected ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-800")
                                : isSold
                                ? (isSelected ? "bg-blue-400 text-white" : "bg-blue-100 text-blue-800")
                                : (isSelected ? "bg-amber-400 text-slate-900" : "bg-amber-100 text-amber-900")
                            }`}
                          >
                            {s.status}
                          </span>
                        </div>
                        <p className={`mt-0.5 text-xs truncate ${isSelected ? "text-blue-100" : "text-slate-600"}`}>
                          {s.itemName} ({s.itemCode})
                        </p>
                      </div>

                      <div className="text-right shrink-0 text-xs">
                        {isSold && s.receiptCode ? (
                          <>
                            <p className="font-semibold font-mono">Receipt: {s.receiptCode}</p>
                            <p className={`text-[11px] ${isSelected ? "text-blue-200" : "text-slate-500"}`}>
                              {s.soldTo || "Customer"} • {formatDate(s.saleDate)}
                            </p>
                          </>
                        ) : isAvailable ? (
                          <span className={`font-semibold ${isSelected ? "text-emerald-300" : "text-emerald-600"}`}>
                            Ready to sell
                          </span>
                        ) : (
                          <span className={isSelected ? "text-slate-300" : "text-slate-500"}>
                            {s.remarks || s.status}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 3. Receipts & Sales */}
          {results.receipts.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                🧾 Receipts &amp; Sales
              </p>
              <div className="mt-1 space-y-1">
                {results.receipts.map((r) => {
                  const currIdx = globalIndexCounter++
                  const isSelected = selectedIndex === currIdx
                  const receiptNum = String(r.receiptCode || "").match(/\d+$/)?.[0]?.padStart(5, "0") || r.receiptCode

                  return (
                    <button
                      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition ${
                        isSelected
                          ? "bg-[#002060] text-white"
                          : "text-slate-800 hover:bg-slate-100"
                      }`}
                      key={r.id}
                      onClick={() => handleSelectItem({ type: "RECEIPT", data: r })}
                      type="button"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <Receipt size={16} className={isSelected ? "text-white" : "text-emerald-700"} />
                          <span className="font-bold font-mono text-sm">Receipt #{receiptNum}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                            r.status === "COMPLETED"
                              ? (isSelected ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-800")
                              : (isSelected ? "bg-red-400 text-white" : "bg-red-100 text-red-800")
                          }`}>
                            {r.status}
                          </span>
                        </div>
                        <p className={`mt-0.5 text-xs ${isSelected ? "text-blue-100" : "text-slate-600"}`}>
                          Customer: <span className="font-semibold">{r.customer?.fullName || "Walk-in"}</span> • {formatDate(r.saleDate || r.createdAt)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm font-mono">{formatMoney(r.grandTotal)}</p>
                        <span className={`text-[11px] font-semibold ${isSelected ? "text-blue-200" : "text-slate-400"}`}>
                          Open receipt details <ArrowRight size={12} className="inline ml-0.5" />
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 4. Quotations */}
          {results.quotations.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                📋 Quotations
              </p>
              <div className="mt-1 space-y-1">
                {results.quotations.map((q) => {
                  const currIdx = globalIndexCounter++
                  const isSelected = selectedIndex === currIdx
                  const quoteNum = String(q.quotationCode || "").match(/\d+$/)?.[0]?.padStart(5, "0") || q.quotationCode

                  return (
                    <button
                      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition ${
                        isSelected
                          ? "bg-[#002060] text-white"
                          : "text-slate-800 hover:bg-slate-100"
                      }`}
                      key={q.id}
                      onClick={() => handleSelectItem({ type: "QUOTATION", data: q })}
                      type="button"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className={isSelected ? "text-white" : "text-[#002060]"} />
                          <span className="font-bold font-mono text-sm">Quotation #{quoteNum}</span>
                          {q.isPcBuild && (
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              PC Build
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>
                            {q.status}
                          </span>
                        </div>
                        <p className={`mt-0.5 text-xs ${isSelected ? "text-blue-100" : "text-slate-600"}`}>
                          Customer: <span className="font-semibold">{q.customer?.fullName || "Walk-in"}</span> • {formatDate(q.createdAt)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm font-mono">{formatMoney(q.grandTotal)}</p>
                        <span className={`text-[11px] font-semibold ${isSelected ? "text-blue-200" : "text-slate-400"}`}>
                          View / Print Quotation <ArrowRight size={12} className="inline ml-0.5" />
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 5. Customers */}
          {results.customers.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                👤 Customers
              </p>
              <div className="mt-1 space-y-1">
                {results.customers.map((c) => {
                  const currIdx = globalIndexCounter++
                  const isSelected = selectedIndex === currIdx

                  return (
                    <button
                      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition ${
                        isSelected
                          ? "bg-[#002060] text-white"
                          : "text-slate-800 hover:bg-slate-100"
                      }`}
                      key={c.id}
                      onClick={() => handleSelectItem({ type: "CUSTOMER", data: c })}
                      type="button"
                    >
                      <div className="flex items-center gap-2.5">
                        <User size={16} className={isSelected ? "text-white" : "text-slate-600"} />
                        <div>
                          <span className="font-bold text-sm">{c.fullName}</span>
                          <p className={`text-xs ${isSelected ? "text-blue-100" : "text-slate-500"}`}>
                            {c.mobileNumber || c.email || "No direct contact"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {c.priceTier ? (
                          <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                            isSelected ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700"
                          }`}>
                            Price Tier {c.priceTier}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {query.trim() &&
            !isLoading &&
            results.products.length === 0 &&
            results.serials.length === 0 &&
            results.receipts.length === 0 &&
            results.quotations.length === 0 &&
            results.customers.length === 0 &&
            matchingModules.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <HelpCircle className="mx-auto size-9 opacity-40" />
                <p className="mt-2 font-bold text-sm text-slate-600">No matching results for "{query}"</p>
                <p className="mt-1 text-xs text-slate-400">Try searching by item name, 5-digit receipt code, or barcode.</p>
              </div>
            )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span><kbd className="rounded border bg-white px-1.5 py-0.5 font-mono text-[10px] shadow-xs">↑</kbd> <kbd className="rounded border bg-white px-1.5 py-0.5 font-mono text-[10px] shadow-xs">↓</kbd> to navigate</span>
            <span><kbd className="rounded border bg-white px-1.5 py-0.5 font-mono text-[10px] shadow-xs">↵</kbd> to select</span>
            <span><kbd className="rounded border bg-white px-1.5 py-0.5 font-mono text-[10px] shadow-xs">esc</kbd> to close</span>
          </div>
          <div className="font-semibold text-slate-600">
            Arunafeltz Omnisearch
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
