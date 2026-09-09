import { useState } from "react"
import { FileSpreadsheet, LoaderCircle } from "lucide-react"

/**
 * Reusable professional Excel Export Button
 * Displays active filtered count and provides loading feedback during spreadsheet generation.
 */
export default function ExportExcelButton({
  onExport,
  filteredCount = null,
  label = "Export Excel",
  disabled = false,
  className = "",
  size = "md",
}) {
  const [isExporting, setIsExporting] = useState(false)

  const handleClick = async () => {
    if (isExporting || disabled || !onExport) return
    setIsExporting(true)
    try {
      await onExport()
    } catch (err) {
      console.error("Export to Excel failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  const isSmall = size === "sm"

  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white font-bold text-emerald-800 shadow-xs transition hover:bg-emerald-50 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed ${
        isSmall ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-xs"
      } ${className}`}
      disabled={disabled || isExporting}
      onClick={handleClick}
      title={
        filteredCount != null
          ? `Export ${filteredCount} filtered record${filteredCount === 1 ? "" : "s"} to Excel (.xlsx)`
          : "Export to Excel (.xlsx)"
      }
      type="button"
    >
      {isExporting ? (
        <LoaderCircle className="animate-spin text-emerald-700" size={isSmall ? 13 : 15} />
      ) : (
        <FileSpreadsheet className="text-emerald-700" size={isSmall ? 13 : 15} />
      )}
      <span>{label}</span>
      {filteredCount != null ? (
        <span className="ml-0.5 rounded-md bg-emerald-100 px-1.5 py-0.2 text-[10px] font-mono font-black text-emerald-900">
          {Number(filteredCount).toLocaleString("en-PH")}
        </span>
      ) : null}
    </button>
  )
}
