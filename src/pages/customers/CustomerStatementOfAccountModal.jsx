import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Printer,
  X,
} from "lucide-react"
import { getAccountsReceivable } from "../../features/customers/customers.api"
import { exportReportExcel } from "../../utils/businessDocumentExport"

function formatMoney(value) {
  if (value === null || value === undefined || value === 0) return ""
  const n = Number(value || 0)
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

function formatAsOfDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export default function CustomerStatementOfAccountModal({
  customerId,
  initialCustomer = null,
  initialItems = null,
  onClose,
  selectedBranch,
  user,
}) {
  const [items, setItems] = useState(initialItems || null)
  const [customerInfo, setCustomerInfo] = useState(initialCustomer || null)
  const [isLoading, setIsLoading] = useState(!initialItems)
  const [errorMessage, setErrorMessage] = useState("")

  const loadData = useCallback(async () => {
    if (!customerId) return
    setIsLoading(true)
    setErrorMessage("")
    try {
      const res = await getAccountsReceivable({ customerId, limit: 500 })
      const fetchedItems = res?.data?.items || []
      setItems(fetchedItems)
      if (fetchedItems.length > 0 && !customerInfo) {
        const first = fetchedItems[0]
        setCustomerInfo({
          id: first.customerId,
          fullName: first.customerName,
          address: first.customerAddress,
          mobileNumber: first.customerMobile,
          companyName: first.companyName,
        })
      }
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.message || err?.message || "Failed to load Statement of Account."
      )
    } finally {
      setIsLoading(false)
    }
  }, [customerId, customerInfo])

  useEffect(() => {
    if (!initialItems) {
      loadData()
    }
  }, [initialItems, loadData])

  // Aging Bucket Calculations based on As-Of Date
  const asOfDate = useMemo(() => new Date(), [])

  const rows = useMemo(() => {
    if (!items) return []
    return items.map((it) => {
      const txDate = it.date ? new Date(it.date) : new Date()
      const diffTime = asOfDate.getTime() - txDate.getTime()
      const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
      const bal = Number(it.balance || 0)

      let bucket_0_30 = 0
      let bucket_31_60 = 0
      let bucket_61_90 = 0
      let bucket_91_120 = 0
      let bucket_121_150 = 0
      let bucket_over_150 = 0

      if (diffDays <= 30) {
        bucket_0_30 = bal
      } else if (diffDays <= 60) {
        bucket_31_60 = bal
      } else if (diffDays <= 90) {
        bucket_61_90 = bal
      } else if (diffDays <= 120) {
        bucket_91_120 = bal
      } else if (diffDays <= 150) {
        bucket_121_150 = bal
      } else {
        bucket_over_150 = bal
      }

      return {
        id: it.id,
        transactionNo: it.transactionNo || it.creditCode || "-",
        date: it.date,
        diffDays,
        bucket_0_30,
        bucket_31_60,
        bucket_61_90,
        bucket_91_120,
        bucket_121_150,
        bucket_over_150,
        total: bal,
      }
    })
  }, [items, asOfDate])

  const totals = useMemo(() => {
    let t_0_30 = 0
    let t_31_60 = 0
    let t_61_90 = 0
    let t_91_120 = 0
    let t_121_150 = 0
    let t_over_150 = 0
    let grandTotal = 0

    rows.forEach((r) => {
      t_0_30 += r.bucket_0_30
      t_31_60 += r.bucket_31_60
      t_61_90 += r.bucket_61_90
      t_91_120 += r.bucket_91_120
      t_121_150 += r.bucket_121_150
      t_over_150 += r.bucket_over_150
      grandTotal += r.total
    })

    return {
      t_0_30,
      t_31_60,
      t_61_90,
      t_91_120,
      t_121_150,
      t_over_150,
      grandTotal,
    }
  }, [rows])

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = () => {
    const custName = customerInfo?.fullName || "CUSTOMER"
    const headers = [
      "TRANSACTION NO.",
      "DATE",
      "0 - 30 DAYS",
      "31 TO 60 DAYS",
      "61 TO 90 DAYS",
      "91 TO 120 DAYS",
      "121 TO 150 DAYS",
      "OVER 150 DAYS",
      "TOTAL",
    ]

    const exportRows = rows.map((r) => [
      r.transactionNo,
      formatDate(r.date),
      r.bucket_0_30 ? Number(r.bucket_0_30) : "",
      r.bucket_31_60 ? Number(r.bucket_31_60) : "",
      r.bucket_61_90 ? Number(r.bucket_61_90) : "",
      r.bucket_91_120 ? Number(r.bucket_91_120) : "",
      r.bucket_121_150 ? Number(r.bucket_121_150) : "",
      r.bucket_over_150 ? Number(r.bucket_over_150) : "",
      Number(r.total || 0),
    ])

    // Add Grand Total row
    exportRows.push([
      "GRAND TOTAL",
      "",
      totals.t_0_30 ? Number(totals.t_0_30) : "",
      totals.t_31_60 ? Number(totals.t_31_60) : "",
      totals.t_61_90 ? Number(totals.t_61_90) : "",
      totals.t_91_120 ? Number(totals.t_91_120) : "",
      totals.t_121_150 ? Number(totals.t_121_150) : "",
      totals.t_over_150 ? Number(totals.t_over_150) : "",
      Number(totals.grandTotal || 0),
    ])

    const cleanName = custName.replace(/[^a-zA-Z0-9]/g, "_")

    exportReportExcel({
      title: `STATEMENT OF ACCOUNT — ${custName.toUpperCase()}`,
      branchName: selectedBranch?.name || user?.branch?.name || "Arunafeltz Computer Parts",
      generatedBy: user?.fullName || user?.username || "Accounting",
      filenamePrefix: `statement_of_account_${cleanName}`,
      headers,
      rows: exportRows,
      activeFilters: [
        { label: "Customer", value: custName },
        { label: "Address", value: customerInfo?.address || "—" },
        { label: "As of Date", value: formatAsOfDate(asOfDate) },
      ],
    })
  }

  const shopName = "ARUNAFELTZ COMPUTER PARTS and ACCESSORIES SHOP"
  const shopAddressLine1 =
    selectedBranch?.address ||
    "Kingspire Business Centre, Km.71, Mac Arthur Highway,"
  const shopAddressLine2 = "San Isidro, City of San Fernando, Pampanga"
  const shopContact = selectedBranch?.contactNo || "0997-732-7689/ 045-404-0673"

  const customerDisplayName = customerInfo?.fullName || "CUSTOMER"
  const customerDisplayAddress = customerInfo?.address || customerInfo?.companyName || "—"

  return (
    <div className="fixed inset-0 z-70 grid place-items-center overflow-y-auto bg-slate-950/70 p-2 sm:p-4 backdrop-blur-xs">
      {/* Print Specific CSS to replicate the exact paper SOA */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #customer-soa-printable, #customer-soa-printable * {
            visibility: visible;
          }
          #customer-soa-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 30px 40px !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <section
        id="customer-soa-printable"
        className="my-auto flex flex-col max-h-[94vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all"
      >
        {/* Top Minimalist Action Bar (hidden in print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">
              Customer Statement of Account (SOA)
            </span>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
              Aging Breakdown
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isLoading || rows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition disabled:opacity-50"
              type="button"
              title="Print official Statement of Account or Save as PDF"
            >
              <Printer size={14} className="text-slate-600" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={isLoading || rows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 shadow-2xs transition disabled:opacity-50"
              type="button"
              title="Export aging statement to Excel"
            >
              <FileSpreadsheet size={14} className="text-emerald-700" />
              <span>Export Excel</span>
            </button>

            <button
              onClick={onClose}
              aria-label="Close Statement of Account"
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Statement Body */}
        <div className="overflow-y-auto p-6 sm:p-10 space-y-6 text-slate-900 bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-xs font-bold text-slate-500">
              <LoaderCircle className="animate-spin text-[var(--color-maroon)]" size={18} />
              Generating Statement of Account…
            </div>
          ) : errorMessage ? (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          ) : (
            <>
              {/* Top Header: Customer (Left) vs Shop Info (Right) */}
              <div className="flex items-start justify-between gap-6">
                {/* Left: Customer & Address */}
                <div className="text-xs space-y-1">
                  <div className="flex gap-2">
                    <span className="font-bold text-slate-900 w-24">CUSTOMER:</span>
                    <span className="font-black text-slate-900 uppercase">
                      {customerDisplayName}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-bold text-slate-900 w-24">ADDRESS:</span>
                    <span className="font-bold text-slate-900 uppercase">
                      {customerDisplayAddress}
                    </span>
                  </div>
                </div>

                {/* Right: Company Letterhead */}
                <div className="text-right text-[11px] leading-tight text-slate-800">
                  <h2 className="font-black text-xs text-slate-950 uppercase">
                    {shopName}
                  </h2>
                  <p className="mt-0.5 text-slate-700">{shopAddressLine1}</p>
                  <p className="text-slate-700">{shopAddressLine2}</p>
                  <p className="mt-0.5 font-medium text-slate-800">{shopContact}</p>
                </div>
              </div>

              {/* Title Section (Center) */}
              <div className="text-center pt-2 pb-1">
                <h1 className="text-sm sm:text-base font-black tracking-wide text-slate-950 uppercase">
                  STATEMENT OF ACCOUNT
                </h1>
                <p className="text-xs font-bold text-slate-800 italic mt-0.5">
                  AS OF {formatAsOfDate(asOfDate)}
                </p>
              </div>

              {/* Exact Aging Columns Table */}
              <div className="border-t-2 border-b-2 border-slate-900 pt-1 pb-1">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-900 text-[10px] font-black uppercase text-slate-900">
                      <th className="py-1.5 pr-2 font-black whitespace-nowrap">TRANSACTION NO.</th>
                      <th className="py-1.5 px-2 font-black whitespace-nowrap">DATE</th>
                      <th className="py-1.5 px-2 text-right font-black whitespace-nowrap">0 - 30 DAYS</th>
                      <th className="py-1.5 px-2 text-right font-black whitespace-nowrap">31 TO 60 DAYS</th>
                      <th className="py-1.5 px-2 text-right font-black whitespace-nowrap">61 TO 90 DAYS</th>
                      <th className="py-1.5 px-2 text-right font-black whitespace-nowrap">91 TO 120 DAYS</th>
                      <th className="py-1.5 px-2 text-right font-black whitespace-nowrap">121 TO 150 DAYS</th>
                      <th className="py-1.5 px-2 text-right font-black whitespace-nowrap">OVER 150 DAYS</th>
                      <th className="py-1.5 pl-2 text-right font-black whitespace-nowrap">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400 font-sans italic">
                          No outstanding invoices or balances found for this customer.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="text-slate-900">
                          <td className="py-1.5 pr-2 font-bold whitespace-nowrap">
                            {row.transactionNo}
                          </td>
                          <td className="py-1.5 px-2 whitespace-nowrap">
                            {formatDate(row.date)}
                          </td>
                          <td className="py-1.5 px-2 text-right whitespace-nowrap">
                            {formatMoney(row.bucket_0_30)}
                          </td>
                          <td className="py-1.5 px-2 text-right whitespace-nowrap">
                            {formatMoney(row.bucket_31_60)}
                          </td>
                          <td className="py-1.5 px-2 text-right whitespace-nowrap">
                            {formatMoney(row.bucket_61_90)}
                          </td>
                          <td className="py-1.5 px-2 text-right whitespace-nowrap">
                            {formatMoney(row.bucket_91_120)}
                          </td>
                          <td className="py-1.5 px-2 text-right whitespace-nowrap">
                            {formatMoney(row.bucket_121_150)}
                          </td>
                          <td className="py-1.5 px-2 text-right whitespace-nowrap">
                            {formatMoney(row.bucket_over_150)}
                          </td>
                          <td className="py-1.5 pl-2 text-right font-bold whitespace-nowrap">
                            {formatMoney(row.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {rows.length > 0 ? (
                    <tfoot>
                      <tr className="border-t-2 border-slate-900 font-mono text-[11px] font-black text-slate-950">
                        <td className="py-2 pr-2 font-sans font-black uppercase" colSpan={2}>
                          GRAND TOTAL
                        </td>
                        <td className="py-2 px-2 text-right">
                          {formatMoney(totals.t_0_30)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {formatMoney(totals.t_31_60)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {formatMoney(totals.t_61_90)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {formatMoney(totals.t_91_120)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {formatMoney(totals.t_121_150)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {formatMoney(totals.t_over_150)}
                        </td>
                        <td className="py-2 pl-2 text-right font-black text-xs">
                          {formatMoney(totals.grandTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>

              {/* Bottom Accounting Note (matching photo) */}
              <div className="pt-4 text-xs text-slate-950 space-y-1">
                <p className="font-bold">Note:</p>
                <p className="font-bold italic">
                  Pls. disregard if payment has been made and send proof payment. Thank you very much.
                </p>
                <div className="pt-6">
                  <p className="font-bold">Arunafeltz Accounting</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Bottom Close (hidden in print) */}
        <footer className="no-print flex items-center justify-end border-t border-slate-200 bg-slate-50/75 px-5 py-3 text-xs">
          <button
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-100 shadow-2xs transition"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  )
}
