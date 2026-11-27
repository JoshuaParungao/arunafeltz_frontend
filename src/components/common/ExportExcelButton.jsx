import { useState } from "react"
import { FileSpreadsheet, LoaderCircle, Printer } from "lucide-react"

/**
 * Reusable professional Excel Export Button
 * When `onPrint` is provided, automatically renders [Print / PDF] button alongside [Export Excel].
 */
export default function ExportExcelButton({
  onExport,
  onClick,
  onPrint,
  filteredCount = null,
  count = null,
  label = "Export Excel",
  printLabel = "Print / PDF",
  disabled = false,
  className = "",
  size = "md",
}) {
  const exportHandler = onExport || onClick
  const recordCount = filteredCount ?? count
  const [isExporting, setIsExporting] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  const handleExportClick = async () => {
    if (isExporting || disabled || !exportHandler) return
    setIsExporting(true)
    try {
      await exportHandler()
    } catch (err) {
      console.error("Export to Excel failed:", err)
    } finally {
      setIsExporting(false)
    }
  }

  const handlePrintClick = async () => {
    if (isPrinting || disabled || !onPrint) return
    setIsPrinting(true)
    try {
      await onPrint()
    } catch (err) {
      console.error("Print / PDF report failed:", err)
    } finally {
      setIsPrinting(false)
    }
  }

  const isSmall = size === "sm"

  const excelButton = (
    <button
      className={`inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white font-bold text-emerald-800 shadow-xs transition hover:bg-emerald-50 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
        isSmall ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-xs"
      } ${!onPrint ? className : ""}`}
      disabled={disabled || isExporting}
      onClick={handleExportClick}
      title={
        recordCount != null
          ? `Export ${recordCount} filtered record${recordCount === 1 ? "" : "s"} to Excel (.xlsx)`
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
      {recordCount != null ? (
        <span className="ml-0.5 rounded-md bg-emerald-100 px-1.5 py-0.2 text-[10px] font-mono font-black text-emerald-900">
          {Number(recordCount).toLocaleString("en-PH")}
        </span>
      ) : null}
    </button>
  )

  if (!onPrint) {
    return excelButton
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        className={`inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 font-bold text-indigo-900 shadow-2xs transition hover:bg-indigo-100 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
          isSmall ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-xs"
        }`}
        disabled={disabled || isPrinting}
        onClick={handlePrintClick}
        title={
          recordCount != null
            ? `Print or Export ${recordCount} record${recordCount === 1 ? "" : "s"} as PDF`
            : "Print or Export as PDF"
        }
        type="button"
      >
        {isPrinting ? (
          <LoaderCircle className="animate-spin text-indigo-600" size={isSmall ? 13 : 15} />
        ) : (
          <Printer className="text-indigo-600" size={isSmall ? 13 : 15} />
        )}
        <span>{printLabel}</span>
      </button>

      {excelButton}
    </div>
  )
}

export { default as PrintReportButton } from "./PrintReportButton"
