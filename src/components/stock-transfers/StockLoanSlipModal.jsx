import { useEffect } from "react"
import { createPortal } from "react-dom"
import { Printer, X } from "lucide-react"
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
    <div class="slip-container">
      <!-- HEADER -->
      <div class="slip-header">
        <div class="header-left">
          <div class="shop-title">ARUNAFELTZ COMPUTER TRADING</div>
          <div class="shop-sub">Inter-Branch Inventory Logistics & Operations</div>
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
        <span class="doc-subtitle">Official Inventory Borrowing & Custody Turnover</span>
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
            ${items.length === 0 ? `
              <tr>
                <td colspan="4" style="text-align: center; color: #94a3b8; padding: 6px;">No items recorded</td>
              </tr>
            ` : items.map((line) => {
              const it = line.item || {}
              const serials = (line.allocations || []).flatMap((a) => (a.serials || []).map((s) => s.serial?.serialNumber || s.serialNumber)).filter(Boolean)
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
            }).join("")}
          </tbody>
        </table>
      </div>

      <!-- BORROW AGREEMENT NOTICE -->
      <div class="loan-notice-box">
        <div class="notice-title">ZERO-SETTLEMENT INTER-BRANCH BORROW COVENANT:</div>
        <p class="notice-text">
          This transfer constitutes a temporary inter-branch stock borrow. <strong>Zero monetary payment or financial settlement is required between branches upon transfer.</strong> The receiving branch holds these units under temporary custody and unconditionally agrees to return the borrowed units back to the issuing branch (Nasoli na), or convert to payable/internal purchase if retained (Babayaran nalang).
        </p>
      </div>

      <!-- SIGNATURE SECTION -->
      <div class="sig-container">
        <div class="sig-col">
          <div class="sig-line"></div>
          <div class="sig-title">Dispatched By (Lending Branch Officer)</div>
          <div class="sig-sub">${approvedBy.fullName || "Authorized Staff"} · ${fromBranch.name || "Issuing Branch"}</div>
        </div>
        <div class="sig-col">
          <div class="sig-line"></div>
          <div class="sig-title">Received &amp; Custody Accepted (Borrower)</div>
          <div class="sig-sub">${postedBy.fullName || requestedBy.fullName || "Receiving Officer"} · ${toBranch.name || "Borrowing Branch"}</div>
        </div>
      </div>
    </div>
  `
}

export function generateStockLoanSlipDocument(transfer) {
  return `
    <style>
      .print-wrapper {
        display: flex;
        flex-direction: column;
        gap: 8mm;
      }
      .slip-container {
        border: 1.5px solid #0f172a;
        padding: 5mm;
        border-radius: 4px;
        background: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        color: #0f172a;
      }
      .cut-divider {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 4mm 0;
        color: #64748b;
        font-size: 9px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      .cut-divider::before, .cut-divider::after {
        content: "";
        flex: 1;
        border-bottom: 1.5px dashed #94a3b8;
      }
      .slip-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #0f172a;
        padding-bottom: 3mm;
        margin-bottom: 2mm;
      }
      .shop-title {
        font-size: 13pt;
        font-weight: 900;
        color: #7a1f2d;
        letter-spacing: 0.02em;
        text-transform: uppercase;
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
        background: #0f172a;
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
        margin-bottom: 1px;
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
        padding: 2px 4px;
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
        margin-bottom: 3mm;
      }
      .notice-title {
        font-size: 6.8pt;
        font-weight: 800;
        color: #3730a3;
        margin-bottom: 1mm;
      }
      .notice-text {
        font-size: 6.8pt;
        color: #312e81;
        line-height: 1.35;
        margin: 0;
      }
      .sig-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15mm;
        margin-top: 2mm;
      }
      .sig-col {
        text-align: center;
      }
      .sig-line {
        border-bottom: 1.5px solid #0f172a;
        margin-bottom: 1.5mm;
        height: 8mm;
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
      @media print {
        @page {
          size: A4 portrait;
          margin: 6mm 8mm;
        }
        .slip-container {
          page-break-inside: avoid;
        }
      }
    </style>
    <div class="print-wrapper">
      <!-- COPY 1: ISSUING BRANCH COPY -->
      ${renderSlipHtml(transfer, "ISSUING BRANCH COPY (LENDER)")}

      <!-- CUT DIVIDER LINE -->
      <div class="cut-divider">
        CUT / DETACH HERE (BRANCH CUSTODY ACKNOWLEDGMENT)
      </div>

      <!-- COPY 2: RECEIVING BRANCH COPY -->
      ${renderSlipHtml(transfer, "RECEIVING BRANCH COPY (BORROWER)")}
    </div>
  `
}

export default function StockLoanSlipModal({ transfer, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  if (!transfer) return null

  const handlePrint = () => {
    const title = `${transfer.transferCode || "StockBorrow"}-2Copies`
    const html = generateStockLoanSlipDocument(transfer)
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
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-900/60 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-300">
                2 Copies Included
              </span>
              <h2 className="text-base font-black text-white">Inter-Branch Stock Borrow Slip</h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Transfer #{transferCode} · Issuing Branch &amp; Receiving Branch Copies
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-md transition"
            >
              <Printer size={15} />
              <span>Print 2 Copies</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="max-h-[75vh] overflow-y-auto bg-slate-100 p-6">
          <div className="mx-auto max-w-[210mm] rounded-sm bg-white p-6 shadow-md border border-slate-200">
            <div
              dangerouslySetInnerHTML={{
                __html: generateStockLoanSlipDocument(transfer),
              }}
            />
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <p className="text-xs text-slate-500">
            Tip: Standard A4 portrait layout with cut divider. Inter-branch stock borrow.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-sm transition"
            >
              <Printer size={14} />
              <span>Print Now</span>
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}
