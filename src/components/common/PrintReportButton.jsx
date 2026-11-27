import { useState } from "react"
import { Printer, LoaderCircle } from "lucide-react"

/**
 * Reusable professional Print / PDF Export Button
 * Matches the design of ExportExcelButton and provides loading feedback during PDF/print generation.
 */
export default function PrintReportButton({
  onPrint,
  filteredCount = null,
  label = "Print / PDF",
  disabled = false,
  className = "",
  size = "md",
}) {
  const [isPrinting, setIsPrinting] = useState(false)

  const handleClick = async () => {
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

  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 font-bold text-indigo-900 shadow-2xs transition hover:bg-indigo-100 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
        isSmall ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-xs"
      } ${className}`}
      disabled={disabled || isPrinting}
      onClick={handleClick}
      title={
        filteredCount != null
          ? `Print or Export ${filteredCount} record${filteredCount === 1 ? "" : "s"} as PDF`
          : "Print or Export as PDF"
      }
      type="button"
    >
      {isPrinting ? (
        <LoaderCircle className="animate-spin text-indigo-600" size={isSmall ? 13 : 15} />
      ) : (
        <Printer className="text-indigo-600" size={isSmall ? 13 : 15} />
      )}
      <span>{label}</span>
      {filteredCount != null ? (
        <span className="ml-0.5 rounded-md bg-indigo-100 px-1.5 py-0.2 text-[10px] font-mono font-black text-indigo-900">
          {Number(filteredCount).toLocaleString("en-PH")}
        </span>
      ) : null}
    </button>
  )
}
