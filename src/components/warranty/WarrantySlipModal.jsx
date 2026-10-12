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
    <div class="slip-container">
      <!-- HEADER -->
      <div class="slip-header">
        <div class="header-left">
          <div class="shop-title">${shopName}</div>
          <div class="shop-sub">${shopAddress}</div>
          <div class="shop-sub">Contact: ${shopContact}</div>
        </div>
        <div class="header-right">
          <div class="copy-badge">${copyLabel}</div>
          <div class="claim-ref">${claimCode}</div>
          <div class="ref-date">Date: ${receivedDateStr}</div>
        </div>
      </div>

      <!-- TITLE BAR -->
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
          <div class="box-title">CLAIM & INVOICE REFERENCE</div>
          <div class="detail-row"><span class="lbl">Claim Reference:</span> <span class="val font-mono font-bold">${claimCode}</span></div>
          <div class="detail-row"><span class="lbl">Sales Invoice / Ref:</span> <span class="val font-mono">${invoiceNo}</span></div>
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
        <div class="box-title">REPORTED DEFECT & INITIAL CONDITION</div>
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
        <div class="terms-title">STANDARD WARRANTY TERMS & INSTRUCTIONS:</div>
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
          <div class="sig-sub">Acknowledged & Accepted Terms</div>
        </div>
        <div class="sig-col">
          <div class="sig-line"></div>
          <div class="sig-title">Authorized Store Staff / Technician</div>
          <div class="sig-sub">${createdBy.fullName || "Store Representative"}</div>
        </div>
      </div>
    </div>
  `
}

export function generateWarrantySlipDocument(claim, slipType = "CLAIM", options = {}) {
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
        padding: 2px 4px;
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
      }
      .loaner-highlight-box {
        border: 1.5px solid #d97706;
        background: #fffbeb;
        padding: 2mm 3mm;
        margin-bottom: 2.5mm;
      }
      .loaner-agreement-text {
        margin-top: 2mm;
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
        margin-bottom: 3mm;
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
        line-height: 1.35;
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
      <!-- COPY 1: CUSTOMER COPY -->
      ${renderSlipHtml(claim, slipType, "CUSTOMER COPY", options)}

      <!-- CUT DIVIDER LINE -->
      <div class="cut-divider">
        CUT / DETACH HERE (OFFICIAL STORE & CLIENT REFERENCE)
      </div>

      <!-- COPY 2: STORE COPY -->
      ${renderSlipHtml(claim, slipType, "STORE / BRANCH COPY", options)}
    </div>
  `
}

export default function WarrantySlipModal({
  claim,
  slipType = "CLAIM",
  options = {},
  onClose,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  if (!claim) return null

  const handlePrint = () => {
    const title = `${claim.claimCode || "Warranty"}-${slipType}-2Copies`
    const html = generateWarrantySlipDocument(claim, slipType, options)
    printBusinessHtml(html, title)
  }

  const claimCode = claim.claimCode || "—"
  let modalTitle = "Warranty Claim Slip"
  if (slipType === "LOANER") modalTitle = "Service Loaner Unit Slip"
  if (slipType === "REPLACEMENT") modalTitle = "Warranty Replacement Voucher"

  return createPortal(
    <div
      aria-label="Printable Warranty Slip"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/70 p-3 sm:p-5 backdrop-blur-xs"
      role="dialog"
    >
      <div className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* MODAL HEADER */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-rose-900/60 border border-rose-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-300">
                2 Copies Included
              </span>
              <h2 className="text-base font-black text-white">{modalTitle}</h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Claim #{claimCode} · Customer Copy &amp; Store Copy on Single Printout
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-md transition"
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

        {/* MODAL BODY PREVIEW */}
        <div className="max-h-[75vh] overflow-y-auto bg-slate-100 p-6">
          <div className="mx-auto max-w-[210mm] rounded-sm bg-white p-6 shadow-md border border-slate-200">
            <div
              dangerouslySetInnerHTML={{
                __html: generateWarrantySlipDocument(claim, slipType, options),
              }}
            />
          </div>
        </div>

        {/* MODAL FOOTER */}
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <p className="text-xs text-slate-500">
            Tip: Standard A4 portrait layout with cut guide. Both Customer and Store copies will print together.
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
