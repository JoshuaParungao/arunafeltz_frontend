import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { FileText, Printer, X } from "lucide-react"
import { printBusinessHtml } from "../../utils/businessDocumentExport"

function formatDate(dateValue, withTime = true) {
  if (!dateValue) return "—"
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return String(dateValue)
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  })
}

function renderSlipHtml(transfer, copyLabel) {
  const fromBranch = transfer.fromBranch || {}
  const toBranch = transfer.toBranch || {}
  const requestedBy = transfer.requestedBy || {}
  const approvedBy = transfer.approvedBy || {}
  const postedBy = transfer.postedBy || {}

  const transferCode = transfer.transferCode || "TRF-PENDING"
  const transferDate = formatDate(transfer.transferDate || transfer.createdAt)
  const items = Array.isArray(transfer.items) ? transfer.items : []

  return `
    <div class="slip-page-card">
      <!-- HEADER -->
      <div class="slip-header">
        <div class="header-left">
          <div class="shop-title">ARUNAFELTZ COMPUTER TRADING</div>
          <div class="shop-sub">Inter-Branch Inventory Logistics &amp; Operations</div>
        </div>
        <div class="header-right">
          <div class="copy-badge">${copyLabel}</div>
          <div class="claim-ref">${transferCode}</div>
          <div class="ref-date">Date: ${transferDate}</div>
        </div>
      </div>

      <!-- TITLE BAR -->
      <div class="doc-banner">
        <span class="doc-title">INTER-BRANCH STOCK BORROW SLIP</span>
        <span class="doc-subtitle">Official Inventory Borrowing &amp; Custody Turnover</span>
      </div>

      <!-- 2-COL BRANCH DETAILS -->
      <div class="grid-2col">
        <div class="detail-box">
          <div class="box-title">ISSUING BRANCH (LENDER)</div>
          <div class="detail-row"><span class="lbl">Branch Name:</span> <span class="val font-bold">${fromBranch.name || "—"}</span></div>
          <div class="detail-row"><span class="lbl">Branch Code:</span> <span class="val font-mono">${fromBranch.code || "—"}</span></div>
          <div class="detail-row"><span class="lbl">Address:</span> <span class="val">${fromBranch.address || "—"}</span></div>
          <div class="detail-row"><span class="lbl">Contact No.:</span> <span class="val">${fromBranch.contactNo || "—"}</span></div>
        </div>

        <div class="detail-box">
          <div class="box-title">RECEIVING BRANCH (BORROWER)</div>
          <div class="detail-row"><span class="lbl">Branch Name:</span> <span class="val font-bold">${toBranch.name || "—"}</span></div>
          <div class="detail-row"><span class="lbl">Branch Code:</span> <span class="val font-mono">${toBranch.code || "—"}</span></div>
          <div class="detail-row"><span class="lbl">Address:</span> <span class="val">${toBranch.address || "—"}</span></div>
          <div class="detail-row"><span class="lbl">Contact No.:</span> <span class="val">${toBranch.contactNo || "—"}</span></div>
        </div>
      </div>

      <!-- ITEMS TABLE -->
      <div class="table-box">
        <div class="box-title">BORROWED INVENTORY ITEMS</div>
        <table class="slip-table">
          <thead>
            <tr>
              <th style="width: 15%;">Item Code</th>
              <th style="width: 40%;">Description</th>
              <th style="width: 15%; text-align: center;">Qty Borrowed</th>
              <th style="width: 30%;">Assigned Serial Numbers</th>
            </tr>
          </thead>
          <tbody>
            ${
              items.length === 0
                ? `
              <tr>
                <td colspan="4" style="text-align: center; color: #94a3b8; padding: 6px;">No items recorded</td>
              </tr>
            `
                : items
                    .map((line) => {
                      const it = line.item || {}
                      const serials = (line.allocations || [])
                        .flatMap((a) =>
                          (a.serials || []).map(
                            (s) => s.serial?.serialNumber || s.serialNumber
                          )
                        )
                        .filter(Boolean)
                      return `
                <tr>
                  <td class="font-mono">${it.itemCode || line.itemCode || "—"}</td>
                  <td><strong>${it.itemName || line.description || "Item"}</strong></td>
                  <td style="text-align: center; font-weight: 700;">${line.quantity || 1}</td>
                  <td class="font-mono" style="font-size: 7pt; color: #334155;">
                    ${serials.length > 0 ? serials.join(", ") : "Non-serialized stock"}
                  </td>
                </tr>
              `
                    })
                    .join("")
            }
          </tbody>
        </table>
      </div>

      <!-- BORROW PURPOSE & AUDIT -->
      <div class="info-box">
        <div class="box-title">TRANSACTION DETAILS &amp; AUDIT TRAIL</div>
        <div class="detail-row"><span class="lbl">Transfer Type:</span> <span class="val font-bold">STOCK BORROW (INTER-BRANCH)</span></div>
        <div class="detail-row"><span class="lbl">Requested By:</span> <span class="val">${requestedBy.fullName || requestedBy.username || "Staff"}</span></div>
        <div class="detail-row"><span class="lbl">Approved By:</span> <span class="val">${approvedBy.fullName || approvedBy.username || "Branch Manager / Owner"}</span></div>
        <div class="detail-row"><span class="lbl">Dispatched By:</span> <span class="val">${postedBy.fullName || postedBy.username || "Warehouse Custodian"}</span></div>
        ${transfer.remarks ? `<div class="detail-row" style="margin-top: 1mm;"><span class="lbl">Remarks / Purpose:</span> <span class="val">${transfer.remarks}</span></div>` : ""}
      </div>

      <!-- BORROW POLICY TERMS -->
      <div class="loan-notice-box">
        <div class="notice-title">MANDATORY INTER-BRANCH BORROW AGREEMENT:</div>
        <p class="notice-text">
          1. <strong>CUSTODIAL ACCOUNTABILITY:</strong> The receiving branch acknowledges legal receipt and custody of the items listed above. These items remain assets of the issuing branch until formally settled.<br/>
          2. <strong>SETTLEMENT MODES:</strong> Borrowed stock must be settled either through (a) physical return ("Nasoli Na") or (b) cost absorption/transfer ("Babayaran Nalang").<br/>
          3. <strong>CONDITION:</strong> In the event of physical return, units must be returned complete with original accessories and packaging in identical working condition.
        </p>
      </div>

      <!-- SIGNATURE SECTION -->
      <div class="sig-container">
        <div class="sig-col">
          <div class="sig-line"></div>
          <div class="sig-title">Released / Dispatched By (Lender)</div>
          <div class="sig-sub">Issuing Branch Authorized Custodian</div>
        </div>
        <div class="sig-col">
          <div class="sig-line"></div>
          <div class="sig-title">Received &amp; Verified By (Borrower)</div>
          <div class="sig-sub">Receiving Branch Authorized Representative</div>
        </div>
      </div>

      <!-- FOOTER NOTE -->
      <div class="slip-footer-note">
        Official Arunafeltz Computer Logistics Document · Inter-Branch Asset Accountability
      </div>
    </div>
  `
}

export function generateStockLoanSlipDocument(transfer, copyMode = "ISSUING") {
  const isBoth = copyMode === "BOTH"
  const isReceiving = copyMode === "RECEIVING"

  return `
    <style>
      @page {
        size: A4 portrait;
        margin: 8mm 10mm;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      .a4-slip-wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 190mm;
        margin: 0 auto;
      }
      .slip-page-wrapper {
        width: 100%;
        box-sizing: border-box;
        page-break-inside: avoid;
      }
      .slip-page-wrapper.page-break {
        page-break-after: always;
        margin-bottom: 8mm;
      }
      .slip-page-card {
        border: 1.5px solid #0f172a;
        padding: 5.5mm 6mm;
        border-radius: 4px;
        background: #ffffff;
        font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #0f172a;
        box-sizing: border-box;
      }
      .slip-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #0f172a;
        padding-bottom: 2.5mm;
        margin-bottom: 2mm;
      }
      .shop-title {
        font-size: 12pt;
        font-weight: 900;
        color: #1e1b4b;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        line-height: 1.2;
      }
      .shop-sub {
        font-size: 7.5pt;
        color: #475569;
        margin-top: 1px;
      }
      .header-right {
        text-align: right;
      }
      .copy-badge {
        display: inline-block;
        padding: 2px 8px;
        font-size: 7.5pt;
        font-weight: 900;
        letter-spacing: 0.05em;
        background: #1e1b4b;
        color: #ffffff;
        border-radius: 2px;
      }
      .claim-ref {
        font-size: 11pt;
        font-weight: 800;
        font-family: monospace;
        color: #0f172a;
        margin-top: 3px;
      }
      .ref-date {
        font-size: 7.5pt;
        color: #64748b;
      }
      .doc-banner {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        padding: 2mm 3mm;
        margin-bottom: 2.5mm;
      }
      .doc-title {
        font-size: 9pt;
        font-weight: 900;
        color: #0f172a;
        letter-spacing: 0.04em;
      }
      .doc-subtitle {
        font-size: 7pt;
        font-weight: 600;
        color: #64748b;
      }
      .grid-2col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2.5mm;
        margin-bottom: 2.5mm;
      }
      .detail-box {
        border: 1px solid #cbd5e1;
        padding: 2mm 3mm;
        border-radius: 2px;
        background: #fafafa;
      }
      .info-box {
        border: 1px solid #cbd5e1;
        padding: 2mm 3mm;
        margin-bottom: 2.5mm;
        background: #fafafa;
      }
      .box-title {
        font-size: 6.8pt;
        font-weight: 800;
        text-transform: uppercase;
        color: #475569;
        letter-spacing: 0.05em;
        margin-bottom: 1.5mm;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 1px;
      }
      .detail-row {
        display: flex;
        font-size: 7.5pt;
        margin-bottom: 1.5px;
        line-height: 1.25;
      }
      .lbl {
        width: 100px;
        color: #64748b;
        font-weight: 600;
        flex-shrink: 0;
      }
      .val {
        color: #0f172a;
        flex: 1;
      }
      .table-box {
        border: 1px solid #cbd5e1;
        padding: 2mm 3mm;
        margin-bottom: 2.5mm;
      }
      .slip-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 7.5pt;
      }
      .slip-table th, .slip-table td {
        border: 1px solid #cbd5e1;
        padding: 2.5px 4px;
        text-align: left;
      }
      .slip-table th {
        background: #f1f5f9;
        font-weight: 700;
        color: #334155;
      }
      .loan-notice-box {
        border: 1.5px solid #6366f1;
        background: #eef2ff;
        padding: 2mm 3mm;
        margin-bottom: 2.5mm;
      }
      .notice-title {
        font-size: 6.8pt;
        font-weight: 800;
        color: #3730a3;
        margin-bottom: 1mm;
      }
      .notice-text {
        font-size: 6.5pt;
        color: #312e81;
        line-height: 1.35;
        margin: 0;
      }
      .sig-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15mm;
        margin-top: 2.5mm;
      }
      .sig-col {
        text-align: center;
      }
      .sig-line {
        border-bottom: 1.5px solid #0f172a;
        margin-bottom: 1.5mm;
        height: 7mm;
      }
      .sig-title {
        font-size: 7.2pt;
        font-weight: 800;
        color: #0f172a;
      }
      .sig-sub {
        font-size: 6.5pt;
        color: #64748b;
      }
      .slip-footer-note {
        margin-top: 2.5mm;
        text-align: center;
        font-size: 6pt;
        color: #94a3b8;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }
      @media print {
        @page {
          size: A4 portrait;
          margin: 8mm 10mm;
        }
        .slip-page-wrapper {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .slip-page-wrapper.page-break {
          page-break-after: always !important;
          break-after: page !important;
          margin-bottom: 0 !important;
        }
      }
    </style>
    <div class="a4-slip-wrapper">
      ${
        isBoth
          ? `
        <div class="slip-page-wrapper page-break">
          ${renderSlipHtml(transfer, "ISSUING BRANCH COPY (LENDER)")}
        </div>
        <div class="slip-page-wrapper">
          ${renderSlipHtml(transfer, "RECEIVING BRANCH COPY (BORROWER)")}
        </div>
      `
          : isReceiving
          ? `
        <div class="slip-page-wrapper">
          ${renderSlipHtml(transfer, "RECEIVING BRANCH COPY (BORROWER)")}
        </div>
      `
          : `
        <div class="slip-page-wrapper">
          ${renderSlipHtml(transfer, "ISSUING BRANCH COPY (LENDER)")}
        </div>
      `
      }
    </div>
  `
}

export default function StockLoanSlipModal({ transfer, onClose }) {
  const [copyMode, setCopyMode] = useState("ISSUING")

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  if (!transfer) return null

  const handlePrint = (modeToPrint = copyMode) => {
    const modeSuffix = modeToPrint === "BOTH" ? "BothCopies-A4" : `${modeToPrint}Copy-A4`
    const title = `${transfer.transferCode || "StockBorrow"}-${modeSuffix}`
    const html = generateStockLoanSlipDocument(transfer, modeToPrint)
    printBusinessHtml(html, title)
  }

  const transferCode = transfer.transferCode || "—"

  return createPortal(
    <div
      aria-label="Printable Stock Borrow Slip"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/70 p-3 sm:p-5 backdrop-blur-xs"
      role="dialog"
    >
      <div className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-900/60 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-300">
                A4 Official Logistics
              </span>
              <h2 className="text-base font-black text-white">Inter-Branch Stock Borrow Slip (A4)</h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Transfer #{transferCode} · Standard A4 Size Inventory Turnover Slip
            </p>
          </div>

          {/* COPY MODE SWITCHER TABS */}
          <div className="flex items-center rounded-xl bg-slate-800 p-1 border border-slate-700">
            <button
              onClick={() => setCopyMode("ISSUING")}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                copyMode === "ISSUING"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Issuing (Lender)
            </button>
            <button
              onClick={() => setCopyMode("RECEIVING")}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                copyMode === "RECEIVING"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Receiving (Borrower)
            </button>
            <button
              onClick={() => setCopyMode("BOTH")}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                copyMode === "BOTH"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Both (2 Pages)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint(copyMode)}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-md transition cursor-pointer"
            >
              <Printer size={15} />
              <span>{copyMode === "BOTH" ? "Print Both A4 (2 Pages)" : "Print A4 (1 Page)"}</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* MODAL BODY PREVIEW (A4 SHEET) */}
        <div className="max-h-[75vh] overflow-y-auto bg-slate-200/80 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[210mm] min-h-[280mm] rounded-sm bg-white p-6 sm:p-8 shadow-xl border border-slate-300">
            <div
              dangerouslySetInnerHTML={{
                __html: generateStockLoanSlipDocument(transfer, copyMode),
              }}
            />
          </div>
        </div>

        {/* MODAL FOOTER */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <FileText size={15} className="text-slate-400" />
            <span>Standard A4 Portrait (210mm × 297mm). Clean single-page fit guaranteed.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => handlePrint("BOTH")}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-800 shadow-2xs transition cursor-pointer"
            >
              <Printer size={14} />
              <span>Print Both Copies</span>
            </button>
            <button
              onClick={() => handlePrint(copyMode)}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer"
            >
              <Printer size={14} />
              <span>Print {copyMode === "BOTH" ? "Both (2 Pages)" : "A4 (1 Page)"}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}
