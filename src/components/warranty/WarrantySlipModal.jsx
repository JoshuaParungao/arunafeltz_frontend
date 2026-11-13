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

function renderSlipHtml(claim, slipType, copyLabel, options = {}) {
  const branch = claim.branch || {}
  const customer = claim.customer || {}
  const item = claim.item || {}
  const serial = claim.serial || {}
  const sale = claim.sale || {}
  const saleItem = claim.saleItem || {}
  const createdBy = claim.createdBy || {}

  const shopName = branch.name || "ARUNAFELTZ COMPUTER TRADING"
  const shopAddress = branch.address || "Main Branch, Philippines"
  const shopContact = branch.contactNo || "Contact No. Available Upon Request"

  const customerName = customer.fullName || claim.customerNameSnapshot || "Walk-in Customer"
  const customerContact = customer.mobileNumber || customer.email || "—"
  const customerAddress = customer.address || "—"

  const itemName = item.itemName || saleItem.itemNameSnapshot || "General Computer Product"
  const itemCode = item.itemCode || saleItem.itemCodeSnapshot || "—"
  const brandModel = [item.brand, item.modelName].filter(Boolean).join(" ") || "—"
  const serialNumber = serial.serialNumber || claim.serialNumber || "—"
  const invoiceNo = sale.receiptCode || claim.receiptCode || "—"
  const claimCode = claim.claimCode || "WTY-PENDING"
  const receivedDateStr = formatDate(claim.receivedAt || claim.createdAt)

  // Title and subtitle per slip type
  let documentTitle = "OFFICIAL WARRANTY CLAIM SLIP"
  let documentSubtitle = "Item Turnover & Evaluation Acknowledgment"
  if (slipType === "LOANER") {
    documentTitle = "SERVICE LOANER UNIT AGREEMENT"
    documentSubtitle = "Temporary Equipment Loan Acknowledgment"
  } else if (slipType === "REPLACEMENT") {
    documentTitle = "WARRANTY REPLACEMENT SLIP"
    documentSubtitle = "Unit Replacement & Warranty Update"
  }

  // Parse loaner metadata if present
  let loanerData = options.loaner || null
  if (!loanerData && claim.remarks && claim.remarks.includes("[LOANER_DATA]:")) {
    try {
      const jsonStr = claim.remarks.split("[LOANER_DATA]:")[1]?.split("[/LOANER_DATA]")[0]
      if (jsonStr) loanerData = JSON.parse(jsonStr)
    } catch {
      // ignore parse error
    }
  }

  // Parse replacement metadata if present
  let replacementData = options.replacement || null
  if (!replacementData && claim.remarks && claim.remarks.includes("[REPLACEMENT_DATA]:")) {
    try {
      const jsonStr = claim.remarks.split("[REPLACEMENT_DATA]:")[1]?.split("[/REPLACEMENT_DATA]")[0]
      if (jsonStr) replacementData = JSON.parse(jsonStr)
    } catch {
      // ignore parse error
    }
  }

  return `
    <div class="slip-page-card">
      <!-- HEADER -->
      <div class="slip-header">
        <div class="header-left">
          <div class="shop-title">${shopName}</div>
          <div class="shop-sub">${shopAddress}</div>
          <div class="shop-sub">Contact No.: ${shopContact}</div>
        </div>
        <div class="header-right">
          <div class="copy-badge">${copyLabel}</div>
          <div class="claim-ref">${claimCode}</div>
          <div class="ref-date">Date Received: ${receivedDateStr}</div>
        </div>
      </div>

      <!-- TITLE BANNER -->
      <div class="doc-banner">
        <span class="doc-title">${documentTitle}</span>
        <span class="doc-subtitle">${documentSubtitle}</span>
      </div>

      <!-- 2-COL DETAILS -->
      <div class="grid-2col">
        <!-- CUSTOMER DETAILS -->
        <div class="detail-box">
          <div class="box-title">CLIENT INFORMATION</div>
          <div class="detail-row"><span class="lbl">Client Name:</span> <span class="val font-bold">${customerName}</span></div>
          <div class="detail-row"><span class="lbl">Contact No.:</span> <span class="val">${customerContact}</span></div>
          <div class="detail-row"><span class="lbl">Address:</span> <span class="val">${customerAddress}</span></div>
        </div>

        <!-- TRANSACTION DETAILS -->
        <div class="detail-box">
          <div class="box-title">CLAIM &amp; TRANSACTION REFERENCE</div>
          <div class="detail-row"><span class="lbl">Claim Reference:</span> <span class="val font-mono font-bold">${claimCode}</span></div>
          <div class="detail-row"><span class="lbl">Invoice / Ref No.:</span> <span class="val font-mono">${invoiceNo}</span></div>
          <div class="detail-row"><span class="lbl">Received By:</span> <span class="val font-bold">${createdBy.fullName || "Store Staff"}</span></div>
        </div>
      </div>

      <!-- DEFECTIVE UNIT DETAILS -->
      <div class="table-box">
        <div class="box-title">SUBMITTED DEFECTIVE UNIT DETAILS</div>
        <table class="slip-table">
          <thead>
            <tr>
              <th style="width: 20%;">Item Code</th>
              <th style="width: 35%;">Item Description / Brand</th>
              <th style="width: 25%;">Serial Number</th>
              <th style="width: 20%;">Current Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="font-mono">${itemCode}</td>
              <td><strong>${itemName}</strong><br/><small style="color: #64748b;">${brandModel}</small></td>
              <td class="font-mono"><strong>${serialNumber}</strong></td>
              <td><span class="status-pill">${claim.status || "IN"}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- REPORTED ISSUE & PHYSICAL CONDITION -->
      <div class="issue-box">
        <div class="box-title">REPORTED DEFECT &amp; INITIAL CONDITION</div>
        <div class="issue-content">
          <p><strong>Reported Problem / Issue:</strong> ${claim.issueDescription || "No specific defect reported."}</p>
          ${claim.customerComplaint ? `<p><strong>Customer Remarks:</strong> ${claim.customerComplaint}</p>` : ""}
          ${claim.diagnosis ? `<p><strong>Initial Diagnosis:</strong> ${claim.diagnosis}</p>` : ""}
        </div>
      </div>

      ${slipType === "LOANER" && loanerData ? `
      <!-- LOANER UNIT SECTION -->
      <div class="loaner-highlight-box">
        <div class="box-title" style="color: #92400e;">ISSUED SERVICE LOANER UNIT (TEMPORARY EQUIPMENT)</div>
        <table class="slip-table">
          <thead>
            <tr>
              <th style="width: 40%;">Loaner Item Description</th>
              <th style="width: 30%;">Loaner Serial Number</th>
              <th style="width: 30%;">Date Issued</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${loanerData.loanerItemName || "Service Unit"}</strong></td>
              <td class="font-mono"><strong style="color: #b45309;">${loanerData.loanerSerialNumber || "—"}</strong></td>
              <td>${formatDate(loanerData.loanedAt || new Date())}</td>
            </tr>
          </tbody>
        </table>
        <div class="loaner-agreement-text">
          <strong>MANDATORY RETURN AGREEMENT:</strong> The client acknowledges receipt of the service loaner unit described above for temporary use while the defective item undergoes warranty evaluation. The client unconditionally agrees to return this loaner unit in the same working condition upon resolution, regardless of whether the warranty claim is approved, repaired, or rejected by the supplier.
        </div>
      </div>
      ` : ""}

      ${slipType === "REPLACEMENT" && replacementData ? `
      <!-- REPLACEMENT UNIT SECTION -->
      <div class="replacement-highlight-box">
        <div class="box-title" style="color: #065f46;">NEW REPLACEMENT UNIT DETAILS</div>
        <table class="slip-table">
          <thead>
            <tr>
              <th style="width: 40%;">Replacement Item Name</th>
              <th style="width: 30%;">New Serial Number</th>
              <th style="width: 30%;">Warranty Coverage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${replacementData.itemName || itemName}</strong></td>
              <td class="font-mono"><strong style="color: #047857;">${replacementData.serialNumber || "—"}</strong></td>
              <td>${replacementData.warrantyDuration || "Fresh Standard Warranty"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ""}

      <!-- TERMS & CONDITIONS -->
      <div class="terms-box">
        <div class="terms-title">STANDARD WARRANTY TERMS &amp; INSTRUCTIONS:</div>
        <ol class="terms-list">
          <li><strong>Presentation of Slip:</strong> This official slip must be presented upon claiming repaired, replaced, or evaluated units.</li>
          <li><strong>60-Day Claim Policy:</strong> Evaluated units not claimed within sixty (60) days from completion notification shall be considered forfeited to cover storage costs.</li>
          <li><strong>Warranty Limitations:</strong> Physical damage, burn marks, liquid spill, broken seals, or unauthorized modifications immediately void warranty coverage.</li>
          <li><strong>Service Loaners:</strong> Any temporarily borrowed equipment remains store property and must be surrendered prior to release of the client's unit.</li>
        </ol>
      </div>

      <!-- SIGNATURE SECTION -->
      <div class="sig-container">
        <div class="sig-col">
          <div class="sig-line"></div>
          <div class="sig-title">Client's Signature over Printed Name</div>
          <div class="sig-sub">Acknowledged &amp; Accepted Terms</div>
        </div>
        <div class="sig-col">
          <div class="sig-line"></div>
          <div class="sig-title">Authorized Store Staff / Technician</div>
          <div class="sig-sub">${createdBy.fullName || "Store Representative"}</div>
        </div>
      </div>

      <!-- FOOTER NOTE -->
      <div class="slip-footer-note">
        Official Arunafeltz Computer Systems &amp; Warranty Document · Please keep this receipt safe.
      </div>
    </div>
  `
}

export function generateWarrantySlipDocument(claim, slipType = "CLAIM", options = {}, copyMode = "CUSTOMER") {
  const isBoth = copyMode === "BOTH"
  const isStore = copyMode === "STORE"

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
        color: #7a1f2b;
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
        margin-bottom: 1.5px;
        line-height: 1.25;
      }
      .lbl {
        width: 105px;
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
      .status-pill {
        display: inline-block;
        font-size: 6.5pt;
        font-weight: 800;
        padding: 1px 4px;
        border-radius: 2px;
        background: #e0f2fe;
        color: #0369a1;
      }
      .issue-box {
        border: 1px solid #cbd5e1;
        padding: 2mm 3mm;
        margin-bottom: 2.5mm;
        background: #fafafa;
      }
      .issue-content p {
        margin: 1px 0;
        font-size: 7.5pt;
        line-height: 1.3;
      }
      .loaner-highlight-box {
        border: 1.5px solid #d97706;
        background: #fffbeb;
        padding: 2mm 3mm;
        margin-bottom: 2.5mm;
      }
      .loaner-agreement-text {
        margin-top: 1.5mm;
        font-size: 6.8pt;
        color: #78350f;
        line-height: 1.35;
        border-top: 1px dashed #d97706;
        padding-top: 1.5mm;
      }
      .replacement-highlight-box {
        border: 1.5px solid #059669;
        background: #ecfdf5;
        padding: 2mm 3mm;
        margin-bottom: 2.5mm;
      }
      .terms-box {
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        padding: 2mm 3mm;
        margin-bottom: 2.5mm;
      }
      .terms-title {
        font-size: 6.8pt;
        font-weight: 800;
        color: #475569;
        margin-bottom: 1mm;
      }
      .terms-list {
        margin: 0;
        padding-left: 14px;
        font-size: 6.5pt;
        color: #475569;
        line-height: 1.3;
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
          ${renderSlipHtml(claim, slipType, "CUSTOMER COPY", options)}
        </div>
        <div class="slip-page-wrapper">
          ${renderSlipHtml(claim, slipType, "STORE RETENTION COPY", options)}
        </div>
      `
          : isStore
          ? `
        <div class="slip-page-wrapper">
          ${renderSlipHtml(claim, slipType, "STORE RETENTION COPY", options)}
        </div>
      `
          : `
        <div class="slip-page-wrapper">
          ${renderSlipHtml(claim, slipType, "CUSTOMER COPY", options)}
        </div>
      `
      }
    </div>
  `
}

export default function WarrantySlipModal({
  claim,
  slipType = "CLAIM",
  options = {},
  onClose,
}) {
  const [copyMode, setCopyMode] = useState("CUSTOMER")

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  if (!claim) return null

  const handlePrint = (modeToPrint = copyMode) => {
    const modeSuffix = modeToPrint === "BOTH" ? "BothCopies-A4" : `${modeToPrint}Copy-A4`
    const title = `${claim.claimCode || "Warranty"}-${slipType}-${modeSuffix}`
    const html = generateWarrantySlipDocument(claim, slipType, options, modeToPrint)
    printBusinessHtml(html, title)
  }

  const claimCode = claim.claimCode || "—"
  let modalTitle = "Warranty Claim Slip (A4)"
  if (slipType === "LOANER") modalTitle = "Service Loaner Unit Agreement (A4)"
  if (slipType === "REPLACEMENT") modalTitle = "Warranty Replacement Voucher (A4)"

  return createPortal(
    <div
      aria-label="Printable Warranty Slip"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/70 p-3 sm:p-5 backdrop-blur-xs"
      role="dialog"
    >
      <div className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* MODAL HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-rose-900/60 border border-rose-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-300">
                A4 Official Receipt
              </span>
              <h2 className="text-base font-black text-white">{modalTitle}</h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Claim #{claimCode} · Authentic Standard A4 Size Receipt
            </p>
          </div>

          {/* COPY MODE SWITCHER TABS */}
          <div className="flex items-center rounded-xl bg-slate-800 p-1 border border-slate-700">
            <button
              onClick={() => setCopyMode("CUSTOMER")}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                copyMode === "CUSTOMER"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Customer Copy
            </button>
            <button
              onClick={() => setCopyMode("STORE")}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                copyMode === "STORE"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Store Copy
            </button>
            <button
              onClick={() => setCopyMode("BOTH")}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                copyMode === "BOTH"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Both Copies (2 Pages)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint(copyMode)}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-md transition cursor-pointer"
            >
              <Printer size={15} />
              <span>
                {copyMode === "BOTH" ? "Print Both A4 (2 Pages)" : "Print A4 (1 Page)"}
              </span>
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

        {/* MODAL BODY PREVIEW (AUTHENTIC A4 SHEET) */}
        <div className="max-h-[75vh] overflow-y-auto bg-slate-200/80 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[210mm] min-h-[280mm] rounded-sm bg-white p-6 sm:p-8 shadow-xl border border-slate-300">
            <div
              dangerouslySetInnerHTML={{
                __html: generateWarrantySlipDocument(claim, slipType, options, copyMode),
              }}
            />
          </div>
        </div>

        {/* MODAL FOOTER */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <FileText size={15} className="text-slate-400" />
            <span>
              Standard A4 Portrait (210mm × 297mm). Clean single-page fit guaranteed.
            </span>
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
