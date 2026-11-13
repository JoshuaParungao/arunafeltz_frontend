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

function formatCurrency(val) {
  const num = Number(val || 0)
  return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function renderVoucherHtml(returnData, copyLabel) {
  const branch = returnData.branch || {}
  const supplier = returnData.supplier || {}
  const createdBy = returnData.createdBy || {}
  const approvedBy = returnData.approvedBy || {}
  const dispatchedBy = returnData.dispatchedBy || {}
  const items = returnData.items || []

  const shopName = branch.name || "ARUNAFELTZ COMPUTER TRADING"
  const shopAddress = branch.address || "Main Branch, Philippines"
  const shopContact = branch.contactNo || "Contact No. Available Upon Request"

  const supplierName = supplier.name || returnData.supplierNameSnapshot || "Supplier / Distributor"
  const supplierContact = supplier.contactPerson || returnData.supplierContactSnapshot || "—"
  const supplierPhone = supplier.contactNo || "—"
  const supplierAddress = supplier.address || "—"
  const supplierTin = supplier.tin || "—"

  const returnCode = returnData.returnCode || "SRTN-PENDING"
  const rmaNo = returnData.supplierRmaNumber || "—"
  const driverName = returnData.driverName || "Store Representative / Courier"
  const vehiclePlate = returnData.vehiclePlate || "—"
  const courierName = returnData.courierName || "Direct Handover"
  const trackingNo = returnData.trackingNumber || "—"
  const dispatchDateStr = formatDate(returnData.dispatchDate || returnData.dispatchedAt || returnData.createdAt)

  const rowsHtml = items
    .map((item, idx) => {
      const it = item.item || {}
      const serial = item.itemSerial?.serialNumber || item.serialNumberSnapshot || "—"
      const sourceBadge =
        item.sourceType === "CUSTOMER_WARRANTY"
          ? `Customer Claim (${item.warrantyClaim?.claimCode || "WTY"})`
          : item.sourceType === "CUSTOMER_RETURN"
          ? `Customer Return (${item.returnRequest?.returnCode || "RET"})`
          : "Store Defective Stock (B.O.)"

      return `
        <tr>
          <td style="text-align: center; font-weight: 700;">${idx + 1}</td>
          <td>
            <div style="font-weight: 700; color: #0f172a;">${it.itemName || "Item"}</div>
            <div style="font-size: 11px; color: #64748b;">${[it.brand, it.modelName].filter(Boolean).join(" ")}</div>
            <div style="font-size: 10px; color: #4338ca; font-weight: 600; margin-top: 2px;">${sourceBadge}</div>
          </td>
          <td style="font-family: monospace; font-size: 12px; font-weight: 700; color: #1e293b;">
            ${serial}
          </td>
          <td style="color: #b91c1c; font-weight: 600; font-size: 11px;">
            ${item.defectReason || "Defective / Bad Order"}
          </td>
          <td style="text-align: center; font-weight: 700;">${Number(item.quantity || 1)}</td>
          <td style="text-align: right; font-family: monospace;">${formatCurrency(item.unitCost)}</td>
          <td style="text-align: right; font-weight: 700; font-family: monospace; color: #0f172a;">${formatCurrency(item.totalCost)}</td>
        </tr>
      `
    })
    .join("")

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
          <div class="claim-ref">${returnCode}</div>
          <div class="ref-date">Pull-out Date: ${dispatchDateStr}</div>
        </div>
      </div>

      <!-- TITLE BANNER -->
      <div class="doc-banner">
        <span class="doc-title">SUPPLIER RETURN & PULL-OUT VOUCHER</span>
        <span class="doc-subtitle">Official Bad Order (B.O.) / RMA Equipment Handover Document</span>
      </div>

      <!-- META SECTION (2-COL) -->
      <div class="meta-grid">
        <div class="meta-box">
          <div class="box-title">SUPPLIER / DISTRIBUTOR DETAILS</div>
          <div class="meta-row"><span class="lbl">Supplier Name:</span> <span class="val font-bold">${supplierName}</span></div>
          <div class="meta-row"><span class="lbl">Contact Person:</span> <span class="val">${supplierContact}</span></div>
          <div class="meta-row"><span class="lbl">Contact Phone:</span> <span class="val">${supplierPhone}</span></div>
          <div class="meta-row"><span class="lbl">Address / Depo:</span> <span class="val">${supplierAddress}</span></div>
          <div class="meta-row"><span class="lbl">TIN:</span> <span class="val">${supplierTin}</span></div>
        </div>

        <div class="meta-box">
          <div class="box-title">DISPATCH & LOGISTICS INFO</div>
          <div class="meta-row"><span class="lbl">Supplier RMA #:</span> <span class="val font-bold" style="color: #4338ca;">${rmaNo}</span></div>
          <div class="meta-row"><span class="lbl">Courier / Mode:</span> <span class="val">${courierName}</span></div>
          <div class="meta-row"><span class="lbl">Driver / Rep:</span> <span class="val font-bold">${driverName}</span></div>
          <div class="meta-row"><span class="lbl">Vehicle Plate #:</span> <span class="val">${vehiclePlate}</span></div>
          <div class="meta-row"><span class="lbl">Waybill / Track #:</span> <span class="val">${trackingNo}</span></div>
        </div>
      </div>

      <!-- TABLE -->
      <div class="table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">#</th>
              <th>Item Description & Source</th>
              <th style="width: 130px;">Serial Number</th>
              <th style="width: 180px;">Reported Defect / Finding</th>
              <th style="width: 45px; text-align: center;">Qty</th>
              <th style="width: 80px; text-align: right;">Unit Cost</th>
              <th style="width: 90px; text-align: right;">Total Cost</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <!-- TOTALS & SUMMARY -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 10px; padding: 8px 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px;">
        <div style="font-size: 11px; color: #475569; max-width: 60%;">
          <strong>Remarks / Handover Instructions:</strong>
          <div>${returnData.notes || "Items listed above are returned for Warranty Replacement, Repair, or Credit Memo. Please confirm received condition."}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; color: #64748b;">Total Defective Units: <strong>${items.length} item(s)</strong></div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">
            Total Value: ${formatCurrency(returnData.subtotalCost)}
          </div>
        </div>
      </div>

      <!-- ACKNOWLEDGMENT & SIGNATURES -->
      <div class="ack-terms">
        <strong>PULL-OUT & HANDOVER ACKNOWLEDGMENT:</strong> The items described above have been pulled out from store inventory and handed over for supplier RMA processing. The supplier representative or courier driver certifies receipt of the listed units in the indicated physical condition.
      </div>

      <div class="signatures-grid">
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-name">${dispatchedBy.fullName || createdBy.fullName || "Store Custodian"}</div>
          <div class="sig-role">Prepared & Released By (Branch Custodian)</div>
        </div>

        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-name">${driverName}</div>
          <div class="sig-role">Pulled Out & Received By (Driver / Courier / Rep)</div>
        </div>

        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-name">${approvedBy.fullName || "Branch Manager / Owner"}</div>
          <div class="sig-role">Verified & Authorized By</div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="slip-footer">
        <div>Arunafeltz POS & Inventory System • Official Pull-Out Voucher • ${returnCode}</div>
        <div>Page 1 of 1</div>
      </div>
    </div>
  `
}

const A4_SLIP_STYLES = `
  @page {
    size: A4 portrait;
    margin: 8mm;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    margin: 0;
    padding: 0;
    background: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    line-height: 1.35;
  }
  .slip-page-card {
    background: #ffffff;
    width: 100%;
    max-width: 210mm;
    min-height: 275mm;
    margin: 0 auto 16px auto;
    padding: 12mm 14mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  @media print {
    body {
      background: #ffffff;
    }
    .slip-page-card {
      box-shadow: none;
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: auto;
      page-break-after: always;
    }
    .slip-page-card:last-child {
      page-break-after: auto;
    }
  }

  .slip-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .shop-title {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0f172a;
    text-transform: uppercase;
  }
  .shop-sub {
    font-size: 11px;
    color: #475569;
    margin-top: 1px;
  }
  .header-right {
    text-align: right;
  }
  .copy-badge {
    display: inline-block;
    padding: 3px 8px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    background: #e2e8f0;
    color: #1e293b;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }
  .claim-ref {
    font-family: monospace;
    font-size: 16px;
    font-weight: 800;
    color: #831843;
    margin-top: 4px;
  }
  .ref-date {
    font-size: 11px;
    color: #64748b;
  }

  .doc-banner {
    background: #0f172a;
    color: #ffffff;
    padding: 6px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 4px;
    margin-bottom: 12px;
  }
  .doc-title {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .doc-subtitle {
    font-size: 10px;
    color: #cbd5e1;
    font-weight: 500;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }
  .meta-box {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px 12px;
    background: #f8fafc;
  }
  .box-title {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 3px;
    margin-bottom: 6px;
  }
  .meta-row {
    font-size: 11px;
    display: flex;
    margin-bottom: 3px;
    align-items: baseline;
  }
  .meta-row .lbl {
    width: 100px;
    color: #64748b;
    flex-shrink: 0;
  }
  .meta-row .val {
    color: #0f172a;
    flex-grow: 1;
  }

  .table-container {
    margin-bottom: 10px;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .items-table th {
    background: #f1f5f9;
    color: #334155;
    font-weight: 700;
    text-align: left;
    padding: 6px 8px;
    border: 1px solid #cbd5e1;
    font-size: 10px;
    text-transform: uppercase;
  }
  .items-table td {
    padding: 6px 8px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
  }

  .ack-terms {
    font-size: 10px;
    color: #475569;
    line-height: 1.4;
    border-left: 3px solid #831843;
    padding: 6px 10px;
    background: #fdf2f8;
    border-radius: 0 4px 4px 0;
    margin-top: 14px;
  }

  .signatures-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
    margin-top: 24px;
    margin-bottom: 10px;
  }
  .sig-block {
    text-align: center;
  }
  .sig-line {
    border-bottom: 1px solid #475569;
    margin-bottom: 4px;
    height: 32px;
  }
  .sig-name {
    font-weight: 700;
    font-size: 11px;
    color: #0f172a;
  }
  .sig-role {
    font-size: 10px;
    color: #64748b;
  }

  .slip-footer {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #94a3b8;
    border-top: 1px solid #e2e8f0;
    padding-top: 6px;
    margin-top: 12px;
  }
`

export default function SupplierReturnSlipModal({
  returnData,
  isOpen,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState("SUPPLIER")

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !returnData) return null

  const handlePrint = (tabType = activeTab) => {
    let bodyHtml = ""
    if (tabType === "BOTH") {
      bodyHtml = `
        ${renderVoucherHtml(returnData, "SUPPLIER COPY")}
        ${renderVoucherHtml(returnData, "STORE WAREHOUSE COPY")}
      `
    } else if (tabType === "DRIVER") {
      bodyHtml = renderVoucherHtml(returnData, "COURIER / DRIVER COPY")
    } else if (tabType === "STORE") {
      bodyHtml = renderVoucherHtml(returnData, "STORE WAREHOUSE COPY")
    } else {
      bodyHtml = renderVoucherHtml(returnData, "SUPPLIER COPY")
    }

    printBusinessHtml(bodyHtml, {
      title: `Supplier_Return_${returnData.returnCode || "VOUCHER"}`,
      styles: A4_SLIP_STYLES,
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[96vh] w-full max-w-4xl flex-col rounded-2xl bg-slate-100 shadow-2xl">
        {/* MODAL BAR */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <FileText className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">
                A4 Supplier Return Pull-Out Slip
              </h3>
              <p className="text-xs text-slate-500">
                Official Pull-Out Voucher #{returnData.returnCode} • {returnData.supplier?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* COPY SELECTOR TABS */}
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("SUPPLIER")}
                className={`rounded-md px-3 py-1.5 transition ${
                  activeTab === "SUPPLIER"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Supplier Copy
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("STORE")}
                className={`rounded-md px-3 py-1.5 transition ${
                  activeTab === "STORE"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Store Copy
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("DRIVER")}
                className={`rounded-md px-3 py-1.5 transition ${
                  activeTab === "DRIVER"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Driver Copy
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("BOTH")}
                className={`rounded-md px-3 py-1.5 transition ${
                  activeTab === "BOTH"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Both Copies
              </button>
            </div>

            <button
              type="button"
              onClick={() => handlePrint(activeTab)}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow hover:bg-slate-800"
            >
              <Printer className="size-4" />
              Print A4 Voucher
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* PREVIEW CONTAINER */}
        <div className="overflow-y-auto p-6">
          <style>{A4_SLIP_STYLES}</style>
          <div
            dangerouslySetInnerHTML={{
              __html:
                activeTab === "BOTH"
                  ? `${renderVoucherHtml(returnData, "SUPPLIER COPY")}${renderVoucherHtml(returnData, "STORE WAREHOUSE COPY")}`
                  : activeTab === "DRIVER"
                  ? renderVoucherHtml(returnData, "COURIER / DRIVER COPY")
                  : activeTab === "STORE"
                  ? renderVoucherHtml(returnData, "STORE WAREHOUSE COPY")
                  : renderVoucherHtml(returnData, "SUPPLIER COPY"),
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
