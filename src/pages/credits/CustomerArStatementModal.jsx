import { useState, useEffect, useCallback, useRef } from "react"
import {
  X,
  Printer,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  CreditCard,
  RotateCcw,
} from "lucide-react"

import { getCustomerArStatement } from "../../features/reports/intelligence.api"
import { exportReportExcel } from "../../utils/businessDocumentExport"
import ExportExcelButton from "../../components/common/ExportExcelButton"

function peso(val) {
  return `₱${Number(val || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function CustomerArStatementModal({
  customerId,
  customerName,
  onClose,
  selectedBranch,
  user,
}) {
  const [statement, setStatement] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const printRef = useRef(null)

  const loadStatement = useCallback(async () => {
    if (!customerId) return
    setIsLoading(true)
    try {
      const res = await getCustomerArStatement(customerId)
      setStatement(res)
    } catch (err) {
      console.error("Failed to load customer statement", err)
      setStatement(null)
    } finally {
      setIsLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    loadStatement()
  }, [loadStatement])

  const customer = statement?.customer || {}
  const summary = statement?.summary || {}
  const accounts = statement?.accounts || []

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = () => {
    const flatLedger = []
    accounts.forEach((acc) => {
      acc.ledger.forEach((entry) => {
        flatLedger.push({
          creditCode: acc.creditCode,
          provider: acc.provider,
          term: acc.term,
          date: entry.date ? new Date(entry.date).toLocaleString("en-PH") : "—",
          type: entry.type,
          reference: entry.reference,
          description: entry.description,
          debit: entry.debit,
          credit: entry.credit,
          runningBalance: entry.runningBalance,
        })
      })
    })

    exportReportExcel({
      label: `Statement of Account — ${customer.fullName || customerName}`,
      filename: `SOA-${(customer.fullName || "Customer").replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        ["Credit Account", (r) => r.creditCode],
        ["Provider", (r) => r.provider],
        ["Term", (r) => r.term],
        ["Transaction Date", (r) => r.date],
        ["Event Type", (r) => r.type],
        ["Reference No", (r) => r.reference],
        ["Description", (r) => r.description],
        ["Billed / Debit", (r) => Number(r.debit || 0)],
        ["Payment / Credit", (r) => Number(r.credit || 0)],
        ["Running Balance", (r) => Number(r.runningBalance || 0)],
      ],
      records: flatLedger,
      branch: selectedBranch || user?.branch,
      generatedBy: user,
      filters: [
        ["Customer Name", customer.fullName || customerName],
        ["Mobile", customer.mobileNumber || "—"],
      ],
      totals: [
        ["Total Obligation", summary.totalObligation || 0],
        ["Total Collections", summary.totalCollected || 0],
        ["Remaining Balance Due", summary.totalRemainingBalance || 0],
      ],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-[var(--color-maroon)]">
              <FileText size={18} />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Customer Statement of Account (SOA)
              </h2>
              <p className="text-[11px] text-slate-500">
                REPORT 20 · Auditable customer obligation and payment ledger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ExportExcelButton
              filteredCount={accounts.length}
              label="Export SOA (.xlsx)"
              onExport={handleExportExcel}
            />
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
              onClick={handlePrint}
              type="button"
            >
              <Printer size={13} />
              Print
            </button>
            <button
              className="grid size-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={onClose}
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body / Printable Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={printRef}>
          {isLoading ? (
            <div className="py-20 text-center font-bold text-slate-400">
              Generating customer statement...
            </div>
          ) : (
            <>
              {/* Customer Banner & Summary */}
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <span className="rounded-md bg-slate-200 px-2 py-0.5 font-mono text-[10px] font-black text-slate-700">
                    CUSTOMER ACCOUNT
                  </span>
                  <h3 className="mt-2 text-xl font-black text-slate-900">
                    {customer.fullName || customerName}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} /> {customer.mobileNumber || "No contact"}
                    </span>
                    {customer.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail size={12} /> {customer.email}
                      </span>
                    ) : null}
                    {customer.address ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} /> {customer.address}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-4 border-t border-slate-200/80 pt-3 md:border-t-0 md:pt-0">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Total Obligation</p>
                    <p className="font-mono text-base font-black text-slate-800">{peso(summary.totalObligation)}</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-emerald-600">Total Collected</p>
                    <p className="font-mono text-base font-black text-emerald-700">{peso(summary.totalCollected)}</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-[var(--color-maroon)]">Outstanding Balance</p>
                    <p className="font-mono text-lg font-black text-[var(--color-maroon)]">{peso(summary.totalRemainingBalance)}</p>
                  </div>
                </div>
              </div>

              {/* Accounts & Ledgers */}
              {accounts.map((acc) => (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs" key={acc.id}>
                  {/* Account Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-900">{acc.creditCode}</span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          {acc.provider}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {acc.term || "Straight"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Linked Receipt: <span className="font-mono font-bold text-slate-600">{acc.receiptCode}</span> · Date: {new Date(acc.saleDate).toLocaleDateString("en-PH")}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-right text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Principal: </span>
                        <span className="font-mono font-bold">{peso(acc.principal)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-indigo-500 uppercase font-bold">Interest: </span>
                        <span className="font-mono font-bold text-indigo-700">+{peso(acc.interest)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--color-maroon)] uppercase font-bold">Remaining: </span>
                        <span className="font-mono font-black text-[var(--color-maroon)]">{peso(acc.remainingBalance)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ledger Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/70 text-[11px] font-black uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Date & Time</th>
                          <th className="px-3 py-2.5">Reference No</th>
                          <th className="px-3 py-2.5">Description</th>
                          <th className="px-3 py-2.5 text-right">Debit (Obligation)</th>
                          <th className="px-3 py-2.5 text-right text-emerald-700">Credit (Payment)</th>
                          <th className="px-4 py-2.5 text-right font-black">Running Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {acc.ledger.map((e, idx) => (
                          <tr className="hover:bg-slate-50/60" key={idx}>
                            <td className="px-4 py-2.5 text-slate-500">
                              {new Date(e.date).toLocaleString("en-PH")}
                            </td>
                            <td className="px-3 py-2.5 font-mono font-bold text-slate-800">
                              {e.reference}
                            </td>
                            <td className="px-3 py-2.5">{e.description}</td>
                            <td className="px-3 py-2.5 text-right font-mono">
                              {e.debit > 0 ? peso(e.debit) : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">
                              {e.credit > 0 ? `-${peso(e.credit)}` : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-black text-slate-900">
                              {peso(e.runningBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
