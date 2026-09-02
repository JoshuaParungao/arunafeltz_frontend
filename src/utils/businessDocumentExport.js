import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

const MAROON = [122, 31, 43]
const DARK = [31, 41, 55]
const MUTED = [100, 116, 139]
const BORDER = [226, 232, 240]

const INSTALLMENT_TERM_MONTHS = {
  STRAIGHT: 1,
  MONTH_3: 3,
  MONTH_6: 6,
  MONTH_9: 9,
  MONTH_12: 12,
  MONTH_18: 18,
  MONTH_24: 24,
}

function number(value) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function text(value, fallback = "-") {
  const normalized = String(value ?? "").trim()
  return normalized || fallback
}

function php(value) {
  return `PHP ${number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function quantity(value) {
  return number(value).toLocaleString("en-PH", {
    maximumFractionDigits: 2,
  })
}

function dateText(value) {
  if (!value) return "-"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return text(value)
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  })
}

function dateTimeText(value = new Date()) {
  const date = new Date(value)

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function branchText(branch) {
  if (!branch) return "All / Unspecified branch"

  const code = text(branch.code, "")
  const name = text(branch.name, "")

  if (code && name) return `${code} - ${name}`
  return code || name || "Unspecified branch"
}

function generatedByText(user) {
  return (
    user?.fullName ||
    user?.name ||
    user?.username ||
    user?.email ||
    "Arunafeltz Computer user"
  )
}

function cleanFilename(value) {
  return String(value || "document")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function normalizeDocument(config) {
  return {
    title: config.title || "Business Document",
    reference: config.reference || "",
    status: config.status || "",
    branch: config.branch || "",
    generatedBy: config.generatedBy || "",
    generatedAt: config.generatedAt || new Date(),
    meta: Array.isArray(config.meta) ? config.meta : [],
    columns: Array.isArray(config.columns) ? config.columns : [],
    rows: Array.isArray(config.rows) ? config.rows : [],
    totals: Array.isArray(config.totals) ? config.totals : [],
    notes: Array.isArray(config.notes)
      ? config.notes.filter((entry) => String(entry?.value || "").trim())
      : [],
    filename: cleanFilename(config.filename || config.reference || config.title),
    orientation: config.orientation || "portrait",
  }
}

export function exportBusinessPdf(rawConfig) {
  const config = normalizeDocument(rawConfig)

  const doc = new jsPDF({
    orientation: config.orientation,
    unit: "mm",
    format: "a4",
  })

  const margin = 12
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setTextColor(...MAROON)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.text("Arunafeltz Computer", margin, 16)

  doc.setTextColor(...MUTED)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text("Cloud POS and Business Monitoring", margin, 21)

  doc.setTextColor(...DARK)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(config.title, margin, 31)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)

  let y = 38

  const headerMeta = [
    ...(config.reference
      ? [["Reference", config.reference]]
      : []),
    ...(config.status
      ? [["Status", config.status]]
      : []),
    ...(config.branch
      ? [["Branch", config.branch]]
      : []),
    ...config.meta,
  ]

  for (const [label, value] of headerMeta) {
    doc.setTextColor(...MUTED)
    doc.setFont("helvetica", "bold")
    doc.text(`${text(label)}:`, margin, y)

    doc.setTextColor(...DARK)
    doc.setFont("helvetica", "normal")

    const wrapped = doc.splitTextToSize(
      text(value),
      pageWidth - margin * 2 - 37,
    )

    doc.text(wrapped, margin + 37, y)

    y += Math.max(5, wrapped.length * 4)
  }

  y += 2

  autoTable(doc, {
    startY: y,
    head: [config.columns],
    body: config.rows,
    theme: "grid",
    margin: {
      left: margin,
      right: margin,
    },
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: DARK,
      lineColor: BORDER,
      lineWidth: 0.15,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: MAROON,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      lineColor: MAROON,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  })

  let cursorY = (doc.lastAutoTable?.finalY || y) + 7

  if (config.totals.length) {
    const totalLabelX = pageWidth - margin - 55
    const totalValueX = pageWidth - margin

    for (const [label, value] of config.totals) {
      if (cursorY > pageHeight - 30) {
        doc.addPage()
        cursorY = 18
      }

      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...MUTED)
      doc.text(text(label), totalLabelX, cursorY)

      doc.setTextColor(...DARK)
      doc.text(text(value), totalValueX, cursorY, {
        align: "right",
      })

      cursorY += 5
    }
  }

  if (config.notes.length) {
    cursorY += 4

    for (const note of config.notes) {
      if (cursorY > pageHeight - 35) {
        doc.addPage()
        cursorY = 18
      }

      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text(text(note.label), margin, cursorY)

      cursorY += 4

      doc.setFont("helvetica", "normal")
      doc.setTextColor(...DARK)

      const wrapped = doc.splitTextToSize(
        text(note.value),
        pageWidth - margin * 2,
      )

      doc.text(wrapped, margin, cursorY)
      cursorY += wrapped.length * 4 + 4
    }
  }

  const pageCount = doc.getNumberOfPages()

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber)

    doc.setDrawColor(...BORDER)
    doc.line(
      margin,
      pageHeight - 12,
      pageWidth - margin,
      pageHeight - 12,
    )

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)

    doc.text(
      `Generated by ${config.generatedBy || "Arunafeltz Computer"} - ${dateTimeText(
        config.generatedAt,
      )}`,
      margin,
      pageHeight - 7,
    )

    doc.text(
      `Page ${pageNumber} of ${pageCount}`,
      pageWidth - margin,
      pageHeight - 7,
      {
        align: "right",
      },
    )
  }

  doc.save(`${config.filename}.pdf`)
}

export function printBusinessDocument(rawConfig) {
  const config = normalizeDocument(rawConfig)

  const popup = window.open(
    "",
    "_blank",
    "width=1100,height=800",
  )

  if (!popup) {
    window.alert("Please allow pop-ups to print this document.")
    return
  }

  const metaRows = [
    ...(config.reference
      ? [["Reference", config.reference]]
      : []),
    ...(config.status
      ? [["Status", config.status]]
      : []),
    ...(config.branch
      ? [["Branch", config.branch]]
      : []),
    ...config.meta,
  ]

  const tableHead = config.columns
    .map((column) => `<th>${escapeHtml(column)}</th>`)
    .join("")

  const tableRows = config.rows
    .map(
      (row) => `
        <tr>
          ${row
            .map((cell) => `<td>${escapeHtml(cell)}</td>`)
            .join("")}
        </tr>
      `,
    )
    .join("")

  const metaHtml = metaRows
    .map(
      ([label, value]) => `
        <div class="meta-row">
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(value)}</span>
        </div>
      `,
    )
    .join("")

  const totalsHtml = config.totals
    .map(
      ([label, value]) => `
        <div class="total-row">
          <strong>${escapeHtml(label)}</strong>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("")

  const notesHtml = config.notes
    .map(
      (note) => `
        <section class="note">
          <strong>${escapeHtml(note.label)}</strong>
          <p>${escapeHtml(note.value)}</p>
        </section>
      `,
    )
    .join("")

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(config.title)}</title>
        <style>
          @page {
            size: A4;
            margin: 14mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
            font-size: 12px;
          }

          .company {
            color: #7a1f2b;
            font-size: 23px;
            font-weight: 800;
          }

          .subtitle {
            margin-top: 2px;
            color: #64748b;
            font-size: 10px;
          }

          h1 {
            margin: 18px 0 10px;
            font-size: 20px;
          }

          .meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px 18px;
            margin-bottom: 16px;
          }

          .meta-row {
            display: grid;
            grid-template-columns: 110px 1fr;
            gap: 8px;
          }

          .meta-row strong {
            color: #64748b;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th {
            padding: 8px;
            background: #7a1f2b;
            color: white;
            border: 1px solid #7a1f2b;
            text-align: left;
            font-size: 10px;
          }

          td {
            padding: 7px 8px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
          }

          tr {
            break-inside: avoid;
          }

          .totals {
            width: 310px;
            margin: 16px 0 0 auto;
          }

          .total-row {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding: 4px 0;
          }

          .note {
            margin-top: 16px;
          }

          .note strong {
            color: #64748b;
          }

          .note p {
            margin: 4px 0 0;
            white-space: pre-wrap;
          }

          footer {
            margin-top: 24px;
            padding-top: 8px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 9px;
          }

          @media print {
            button {
              display: none !important;
            }
          }
        </style>
      </head>

      <body>
        <div class="company">Arunafeltz Computer</div>
        <div class="subtitle">Cloud POS and Business Monitoring</div>

        <h1>${escapeHtml(config.title)}</h1>

        <div class="meta">
          ${metaHtml}
        </div>

        <table>
          <thead>
            <tr>${tableHead}</tr>
          </thead>

          <tbody>
            ${tableRows}
          </tbody>
        </table>

        ${
          totalsHtml
            ? `<div class="totals">${totalsHtml}</div>`
            : ""
        }

        ${notesHtml}

        <footer>
          Generated by ${escapeHtml(
            config.generatedBy || "Arunafeltz Computer",
          )} -
          ${escapeHtml(dateTimeText(config.generatedAt))}
        </footer>
      </body>
    </html>
  `)

  popup.document.close()

  window.setTimeout(() => {
    popup.focus()
    popup.print()
  }, 250)
}

export function purchaseOrderDocument(order, context = {}) {
  const lines = Array.isArray(order?.items) ? order.items : []

  let computedSubtotal = 0
  let computedDiscount = 0

  const rows = lines.map((line) => {
    const ordered = number(line.quantity)
    const received = number(line.receivedQuantity)
    const unitCost = number(line.unitCost)
    const discount = number(line.discountAmount)

    const gross = ordered * unitCost
    const lineTotal =
      line.lineTotal != null
        ? number(line.lineTotal)
        : Math.max(0, gross - discount)

    computedSubtotal += gross
    computedDiscount += discount

    return [
      text(line.item?.itemCode || "Unlinked"),
      text(line.description),
      quantity(ordered),
      quantity(received),
      php(unitCost),
      php(discount),
      php(lineTotal),
    ]
  })

  const subtotal =
    order?.subtotal != null
      ? number(order.subtotal)
      : computedSubtotal

  const totalDiscount =
    order?.totalDiscount != null
      ? number(order.totalDiscount)
      : computedDiscount

  const grandTotal =
    order?.grandTotal != null
      ? number(order.grandTotal)
      : Math.max(0, subtotal - totalDiscount)

  return {
    title: "Purchase Order",
    reference: text(order?.poCode),
    status: text(order?.status),
    branch: branchText(order?.branch || context.branch),
    generatedBy: generatedByText(context.generatedBy),
    filename: `${text(order?.poCode, "Purchase-Order")}_${new Date()
      .toISOString()
      .slice(0, 10)}`,
    meta: [
      ["Supplier", text(order?.supplierNameSnapshot || order?.supplier?.name)],
      ["Order date", dateText(order?.orderDate)],
      ["Expected date", dateText(order?.expectedDate)],
    ],
    columns: [
      "Item Code",
      "Description",
      "Ordered",
      "Received",
      "Unit Cost",
      "Discount",
      "Line Total",
    ],
    rows,
    totals: [
      ["Subtotal", php(subtotal)],
      ["Discount", php(totalDiscount)],
      ["Grand Total", php(grandTotal)],
    ],
    notes: [
      {
        label: "Notes",
        value: order?.notes || "",
      },
    ],
  }
}

export function receivingDocument(receiving, context = {}) {
  const lines = Array.isArray(receiving?.items)
    ? receiving.items
    : []

  let computedSubtotal = 0
  let computedDiscount = 0

  const rows = lines.map((line) => {
    const qty = number(line.quantityReceived)
    const unitCost = number(line.unitCost)
    const discount = number(line.discountAmount)
    const gross = qty * unitCost

    const lineTotal =
      line.lineTotal != null
        ? number(line.lineTotal)
        : Math.max(0, gross - discount)

    computedSubtotal += gross
    computedDiscount += discount

    const serials = Array.isArray(line.serials)
      ? line.serials
          .map((serial) => serial.serialNumber)
          .filter(Boolean)
          .join(", ")
      : ""

    return [
      text(line.item?.itemCode),
      text(line.item?.itemName || line.description),
      quantity(qty),
      php(unitCost),
      php(discount),
      text(line.batchCode),
      dateText(line.expiryDate),
      serials || "-",
      php(lineTotal),
    ]
  })

  const subtotal =
    receiving?.subtotal != null
      ? number(receiving.subtotal)
      : computedSubtotal

  const totalDiscount =
    receiving?.totalDiscount != null
      ? number(receiving.totalDiscount)
      : computedDiscount

  const grandTotal =
    receiving?.grandTotal != null
      ? number(receiving.grandTotal)
      : Math.max(0, subtotal - totalDiscount)

  return {
    title: "Purchase Receiving / Delivery",
    reference: text(receiving?.receivingCode),
    status: text(receiving?.status),
    branch: branchText(receiving?.branch || context.branch),
    generatedBy: generatedByText(context.generatedBy),
    filename: `${text(
      receiving?.receivingCode,
      "Receiving",
    )}_${new Date().toISOString().slice(0, 10)}`,
    orientation: "landscape",
    meta: [
      ["Supplier", text(receiving?.supplierNameSnapshot)],
      [
        "Purchase order",
        text(receiving?.purchaseOrder?.poCode || "Standalone"),
      ],
      ["Receiving date", dateText(receiving?.receivingDate)],
      ["Delivery no.", text(receiving?.supplierDeliveryNo)],
      ["Invoice no.", text(receiving?.supplierInvoiceNo)],
      ["Reference", text(receiving?.referenceNo)],
    ],
    columns: [
      "Item Code",
      "Item",
      "Qty",
      "Unit Cost",
      "Discount",
      "Batch",
      "Expiry",
      "Serial Number(s)",
      "Line Total",
    ],
    rows,
    totals: [
      ["Subtotal", php(subtotal)],
      ["Discount", php(totalDiscount)],
      ["Grand Total", php(grandTotal)],
    ],
    notes: [
      {
        label: "Notes",
        value: receiving?.notes || "",
      },
    ],
  }
}

export function inventoryDocument(items, context = {}) {
  const records = Array.isArray(items) ? items : []

  return {
    title: "Inventory Stock Report",
    reference: "",
    status: "",
    branch: branchText(context.branch),
    generatedBy: generatedByText(context.generatedBy),
    filename: `Inventory_${cleanFilename(
      branchText(context.branch),
    )}_${new Date().toISOString().slice(0, 10)}`,
    orientation: "landscape",
    meta: Array.isArray(context.filters)
      ? context.filters
      : [],
    columns: [
      "Item Code",
      "Product Name",
      "Category",
      "Available",
      "Total In",
      "Batches",
      "Serials",
      "Reorder",
      "Tracking",
      "Stock Level",
      "Branch",
    ],
    rows: records.map((item) => [
      text(item.itemCode),
      text(item.itemName),
      text(item.category?.name),
      quantity(item.quantityAvailable),
      quantity(item.quantityIn),
      quantity(item.batchCount),
      quantity(item.serialCount),
      quantity(item.reorderLevel),
      item.isSerialized ? "Serialized" : "Non-serialized",
      number(item.quantityAvailable) <= 0
        ? "Out of stock"
        : item.isLowStock
          ? "Low stock"
          : "Stock is okay",
      text(item.branch?.code || item.branch?.name),
    ]),
    totals: [
      ["Inventory item count", quantity(records.length)],
      [
        "Total available units",
        quantity(
          records.reduce(
            (sum, item) =>
              sum + number(item.quantityAvailable),
            0,
          ),
        ),
      ],
    ],
  }
}

export function reportDocument({
  label,
  columns,
  records,
  totals = [],
  branch,
  generatedBy,
  filters = [],
  filename,
}) {
  const safeColumns = Array.isArray(columns) ? columns : []
  const safeRecords = Array.isArray(records) ? records : []

  return {
    title: label || "Business Report",
    branch: branchText(branch),
    generatedBy: generatedByText(generatedBy),
    filename:
      filename ||
      `${cleanFilename(label || "Report")}_${new Date()
        .toISOString()
        .slice(0, 10)}`,
    orientation:
      safeColumns.length >= 7 ? "landscape" : "portrait",
    meta: filters,
    totals: Array.isArray(totals) ? totals : [],
    columns: safeColumns.map(([columnLabel]) =>
      text(columnLabel),
    ),
    rows: safeRecords.map((record) =>
      safeColumns.map(([, accessor]) => {
        try {
          return text(accessor(record))
        } catch {
          return "-"
        }
      }),
    ),
  }
}

export function exportWarrantyReceiptPdf(sale, options = {}) {
  const context = options.context || {}
  // Strict A4 portrait format: 210mm x 297mm
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  })

  const margin = 12
  const pageWidth = 210
  const contentWidth = pageWidth - margin * 2 // 186mm

  const branch = sale?.branch || context?.branch || {}
  const customer = sale?.customer || {}
  const cashier = sale?.cashier || {}
  const quotation = sale?.quotation || {}
  let technician =
    sale?.technician?.fullName ||
    quotation?.serviceDoneBy?.fullName ||
    context?.technician ||
    ""

  if (!technician || technician === "—") {
    const serviceItemWithDoneBy = (sale?.items || []).find((item) =>
      typeof item.description === "string" && item.description.includes("[Done by:")
    )
    if (serviceItemWithDoneBy) {
      const match = serviceItemWithDoneBy.description.match(/\[Done by:\s*([^\]]+)\]/)
      if (match && match[1]) {
        technician = match[1].trim()
      }
    }
  }

  if (!technician) {
    technician = "—"
  }

  let paymentType = "CASH"
  if (sale?.creditAccount) {
    const provider = String(sale.creditAccount.provider || sale.paymentMethod || "").replaceAll("_", " ")
    if ((sale?.payments || []).length > 0) {
      const dp = sale.payments
        .map((p) => String(p.paymentMethod || "").replaceAll("_", " "))
        .join(", ")
      paymentType = `${provider} (DP: ${dp})`
    } else {
      paymentType = `${provider} Receivable`
    }
  } else if ((sale?.payments || []).length > 0) {
    paymentType = sale.payments
      .map((p) => String(p.paymentMethod || "").replaceAll("_", " "))
      .join(", ")
  }

  const terms =
    sale?.creditAccount?.term || sale?.receivable?.term || sale?.creditTerm
      ? `${String(sale?.creditAccount?.term || sale?.receivable?.term || sale?.creditTerm).replaceAll("_", " ")}`
      : "FULL / OUTRIGHT"

  // -----------------------------------------------------------------
  // 1. HEADER SECTION (Store Details on Left, Meta on Right)
  // Left column: 0 to 96mm. Right column: starts at 102mm.
  // Guaranteed 6mm clear gap between columns to eliminate collision.
  // -----------------------------------------------------------------
  const leftColX = margin
  const leftColWidth = 96

  const rightColX = margin + 102
  const rightLabelWidth = 26
  const rightValX = rightColX + rightLabelWidth
  const rightValWidth = contentWidth - 102 - rightLabelWidth // 58mm

  // Left side: Company Name & Address
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  const storeTitleLines = doc.splitTextToSize(
    "ARUNAFELTZ COMPUTER PARTS AND ACCESSORIES SHOP",
    leftColWidth
  )
  doc.text(storeTitleLines, leftColX, 14)

  let leftY = 14 + storeTitleLines.length * 3.8 + 0.5
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(50, 50, 50)
  const branchAddress =
    branch.address ||
    "Kingspire Business Centre, Km.71, Mac Arthur Highway, San Isidro, City of San Fernando, Pampanga"
  const addressLines = doc.splitTextToSize(branchAddress, leftColWidth)
  doc.text(addressLines, leftColX, leftY)

  leftY += addressLines.length * 3.4 + 1
  const branchContact = branch.contactNo || "0961-873-5798 / 045-404-0673"
  doc.text(branchContact, leftColX, leftY)
  leftY += 4

  // Right side: Transaction Metadata
  let rightY = 14
  const saleDateFormatted = sale?.saleDate
    ? new Date(sale.saleDate).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).toUpperCase()
    : "—"

  const metaRows = [
    ["Date:", saleDateFormatted],
    ["Customer Name:", (customer.fullName || "Walk-in customer").toUpperCase()],
    ["Address:", customer.address || "—"],
    ["Contact No.:", customer.mobileNumber || customer.email || "—"],
    ["Salesman:", (cashier.fullName || cashier.username || "—").toUpperCase()],
    ["Payment Type:", paymentType],
    ["TERMS:", terms],
    ["TECHNICIAN:", technician.toUpperCase()],
  ]

  for (const [lbl, val] of metaRows) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(70, 70, 70)
    doc.text(lbl, rightColX, rightY)

    doc.setFont("helvetica", "normal")
    doc.setTextColor(0, 0, 0)
    const valLines = doc.splitTextToSize(String(val || "—"), rightValWidth)
    doc.text(valLines, rightValX, rightY)

    rightY += Math.max(3.4, valLines.length * 3.1 + 0.3)
  }

  // -----------------------------------------------------------------
  // 2. BANNER: EXACT ORIGINAL "WARRANTY RECEIPT" (Navy Blue Bold Italic)
  // -----------------------------------------------------------------
  const bannerY = Math.max(leftY, rightY) + 5

  // Centered Title Banner exactly like Excel: Bold Italic, Color #002060
  doc.setFont("helvetica", "bolditalic")
  doc.setFontSize(11)
  doc.setTextColor(0, 32, 96) // #002060 Navy Blue
  doc.text("WARRANTY RECEIPT", margin + contentWidth / 2 - 8, bannerY, { align: "center" })

  // Receipt Number on Right
  doc.setFont("helvetica", "bolditalic")
  doc.setFontSize(9)
  doc.setTextColor(0, 32, 96)
  doc.text("No.", margin + contentWidth - 28, bannerY)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(0, 32, 96)
  doc.text(sale?.receiptCode || "—", margin + contentWidth, bannerY, { align: "right" })

  // Underline for receipt number like in Excel border
  const codeWidth = doc.getTextWidth(sale?.receiptCode || "—")
  doc.setLineWidth(0.3)
  doc.setDrawColor(0, 32, 96)
  doc.line(margin + contentWidth - codeWidth - 1, bannerY + 1.2, margin + contentWidth, bannerY + 1.2)

  // -----------------------------------------------------------------
  // 3. ITEMS TABLE
  // -----------------------------------------------------------------
  const tableStartY = bannerY + 6

  const isCredit = Boolean(sale?.creditAccount || options?.isCredit)
  const termBasis = Number(sale?.creditAccount?.termBasis || (isCredit && options?.installmentCalculation?.termBasis) || 1)

  const tableHead = [["ITEM CODE", "ITEM DESCRIPTION", "QTY.", "UNIT PRICE", "AMOUNT"]]
  const tableBody = (sale?.items || []).map((item) => {
    const itemCode = item.itemCodeSnapshot || item.item?.itemCode || "—"
    const isSerialized = item.serial?.serialNumber || item.serialNumber
    const serialText = isSerialized ? ` | S/N: ${isSerialized}` : ""
    const warrantyBadge = (item.warrantyDuration || (item.item?.hasWarranty ? "1 YEAR WARRANTY" : "")).trim()
    const warrantyText = warrantyBadge ? ` | ${warrantyBadge}` : ""
    const fullDescription = `${item.description || item.item?.itemName || "Item"}${warrantyText}${serialText}`

    const qty = String(Number(item.quantity || 1))
    const baseUnitPrice = Number(item.baseUnitPriceSnapshot ?? item.baseUnitPrice ?? item.unitPrice ?? 0)
    const rawUnitPrice = termBasis < 1
      ? Math.round((baseUnitPrice / termBasis) * 100) / 100
      : Number(item.unitPrice || 0)
    const rawLineTotal = termBasis < 1
      ? Math.round((Number(item.quantity || 1) * rawUnitPrice) * 100) / 100
      : Number(item.lineTotal || (Number(item.quantity || 1) * rawUnitPrice))

    const unitPrice = rawUnitPrice.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const lineTotal = rawLineTotal.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    return [itemCode, fullDescription, qty, unitPrice, lineTotal]
  })

  autoTable(doc, {
    startY: tableStartY,
    head: tableHead,
    body: tableBody,
    theme: "plain",
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: { top: 1.6, bottom: 1.6, left: 1.2, right: 1.2 },
      textColor: [0, 0, 0],
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fontStyle: "bold",
      textColor: [0, 0, 0],
      fontSize: 8,
      lineWidth: { top: 0.7, bottom: 0.7 },
      lineColor: [0, 0, 0],
      cellPadding: { top: 2, bottom: 2, left: 1.2, right: 1.2 },
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: "bold" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 27, halign: "right", fontStyle: "bold" },
    },
  })

  let finalY = doc.lastAutoTable?.finalY || tableStartY + 20

  // Double bottom line after items
  doc.setLineWidth(0.6)
  doc.setDrawColor(0, 0, 0)
  doc.line(margin, finalY + 1, margin + contentWidth, finalY + 1)
  doc.line(margin, finalY + 1.8, margin + contentWidth, finalY + 1.8)

  finalY += 4

  // -----------------------------------------------------------------
  // 4. TOTALS & FINANCIAL SUMMARY
  // -----------------------------------------------------------------
  // Left: Non-BIR disclaimer
  doc.setFont("helvetica", "italic")
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  doc.text("This receipt is not valid for input tax.", margin, finalY + 4)

  // Right: Financials
  const totalsLabelX = margin + contentWidth - 65
  const totalsValueX = margin + contentWidth

  const totalAmount = isCredit && (sale?.creditAccount?.regularPriceTotalAmount || sale?.creditAccount?.principalAmount)
    ? Number(sale.creditAccount.regularPriceTotalAmount || sale.creditAccount.principalAmount)
    : Number(sale?.grandTotal || sale?.subtotal || 0)
  const paidAmount = Number(sale?.amountPaid ?? sale?.creditAccount?.downpaymentAmount ?? sale?.creditAccount?.initialPaymentAmount ?? 0)
  const balanceToPay = isCredit && (sale?.creditAccount?.balanceAmount != null || sale?.creditAccount?.financedBalance != null)
    ? Number(sale.creditAccount.balanceAmount ?? sale.creditAccount.financedBalance)
    : Math.max(0, totalAmount - paidAmount)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 0)

  doc.text("TOTAL AMOUNT", totalsLabelX, finalY + 4)
  doc.text(
    totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    totalsValueX,
    finalY + 4,
    { align: "right" }
  )

  if (isCredit || paidAmount > 0) {
    doc.text(isCredit ? "CASH DOWNPAYMENT / PAID" : "AMOUNT PAID", totalsLabelX, finalY + 8)
    doc.text(
      paidAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      totalsValueX,
      finalY + 8,
      { align: "right" }
    )
  }

  doc.text("BALANCE TO PAY", totalsLabelX, finalY + 12)
  doc.text(
    balanceToPay.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    totalsValueX,
    finalY + 12,
    { align: "right" }
  )

  if (isCredit && sale?.creditAccount?.monthlyDueAmount) {
    const months = sale.creditAccount.months || (INSTALLMENT_TERM_MONTHS?.[sale.creditAccount.term] || "")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(0, 32, 96)
    doc.text(`MONTHLY (${months ? `${months} MOS` : "AMORTIZATION"}):`, totalsLabelX, finalY + 16)
    doc.text(
      `${Number(sale.creditAccount.monthlyDueAmount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo`,
      totalsValueX,
      finalY + 16,
      { align: "right" }
    )
  }

  finalY += isCredit && sale?.creditAccount?.monthlyDueAmount ? 23 : 19

  // -----------------------------------------------------------------
  // 5. WARRANTY DISCLAIMERS (Centered)
  // -----------------------------------------------------------------
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  doc.text(
    "NO WARRANTY ON SOFTWARE/S (O.S. - WINDOWS and MS OFFICE), IF ANY",
    margin + contentWidth / 2,
    finalY,
    { align: "center" }
  )

  doc.setFontSize(7)
  doc.text(
    "Pls. read all WARRANTY GUIDELINES & PROCEDURES at the back of this page. (BRING –IN WARRANTY)",
    margin + contentWidth / 2,
    finalY + 3.6,
    { align: "center" }
  )

  finalY += 9

  // -----------------------------------------------------------------
  // 6. SIGNATURES SECTION
  // -----------------------------------------------------------------
  const sigColWidth = contentWidth / 4

  // Received notice placed on its own line above the 4th column
  doc.setFont("helvetica", "italic")
  doc.setFontSize(7.5)
  doc.setTextColor(50, 50, 50)
  doc.text(
    "Received Items in good order and Condition",
    margin + sigColWidth * 3 + (sigColWidth - 4) / 2,
    finalY,
    { align: "center" }
  )

  finalY += 4

  const sigColStartX = [
    margin,
    margin + sigColWidth + 2,
    margin + sigColWidth * 2 + 4,
    margin + sigColWidth * 3 + 6,
  ]
  const sigLineW = sigColWidth - 4

  const sigRows = [
    { label: "Prepared by:", name: (cashier.fullName || cashier.username || "Staff").toUpperCase(), sub: "" },
    { label: "Warehouse:", name: "", sub: "Staff" },
    { label: "Releasing:", name: "", sub: "Staff" },
    { label: "Received by:", name: "", sub: "Signature over Printed Name" },
  ]

  for (let i = 0; i < 4; i++) {
    const col = sigRows[i]
    const x = sigColStartX[i]

    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(70, 70, 70)
    doc.text(col.label, x, finalY)

    if (col.name) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(7.5)
      doc.setTextColor(0, 0, 0)
      doc.text(col.name, x + sigLineW / 2, finalY + 6.5, { align: "center" })
    }

    doc.setLineWidth(0.3)
    doc.setDrawColor(120, 120, 120)
    doc.line(x, finalY + 8, x + sigLineW, finalY + 8)

    if (col.sub) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(6.5)
      doc.setTextColor(100, 100, 100)
      doc.text(col.sub, x + sigLineW / 2, finalY + 11.5, { align: "center" })
    }
  }

  if (options.autoPrint) {
    doc.autoPrint()
    const blobUrl = doc.output("bloburl")
    window.open(blobUrl, "_blank")
  } else {
    const filename = `Warranty-Receipt-${sale?.receiptCode || "receipt"}.pdf`
    doc.save(filename)
  }
}

export function printWarrantyReceipt(sale, options = {}) {
  exportWarrantyReceiptPdf(sale, { ...options, autoPrint: true })
}

export function exportCustomerQuotationPdf(quotation, options = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  })

  const margin = 12
  const pageWidth = 210
  const contentWidth = pageWidth - margin * 2

  const branch = quotation?.branch || {}
  const customer = quotation?.customer || {}
  const salesman =
    quotation?.preparedBy?.fullName ||
    quotation?.preparedBy?.username ||
    quotation?.cashier?.fullName ||
    quotation?.cashier?.username ||
    quotation?.salesman ||
    "—"

  // -----------------------------------------------------------------
  // 1. HEADER SECTION (Store Details on Left, Meta on Right)
  // -----------------------------------------------------------------
  const leftColX = margin
  const leftColWidth = 96

  const rightColX = margin + 102
  const rightLabelWidth = 26
  const rightValX = rightColX + rightLabelWidth
  const rightValWidth = contentWidth - 102 - rightLabelWidth

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  const storeTitleLines = doc.splitTextToSize(
    "ARUNAFELTZ COMPUTER PARTS AND ACCESSORIES SHOP",
    leftColWidth
  )
  doc.text(storeTitleLines, leftColX, 14)

  let leftY = 14 + storeTitleLines.length * 3.8 + 0.5
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(50, 50, 50)
  const branchAddress =
    branch.address ||
    "Kingspire Business Centre, Km.71, Mac Arthur Highway, San Isidro, City of San Fernando, Pampanga"
  const addressLines = doc.splitTextToSize(branchAddress, leftColWidth)
  doc.text(addressLines, leftColX, leftY)

  leftY += addressLines.length * 3.4 + 1
  const branchContact = branch.contactNo || "0961-873-5798 / 045-404-0673"
  doc.text(branchContact, leftColX, leftY)
  leftY += 4

  // Right side: Customer & Meta Details
  let rightY = 14
  const quoteDate = quotation?.createdAt || quotation?.quotationDate || new Date()
  const formattedDate = new Date(quoteDate).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).toUpperCase()

  const metaRows = [
    ["Date:", formattedDate],
    ["Customer Name:", (customer.fullName || "Walk-in customer").toUpperCase()],
    ["Address:", customer.address || "—"],
    ["Contact No.:", customer.mobileNumber || customer.email || "—"],
    ["Salesman:", String(salesman).toUpperCase()],
  ]

  for (const [lbl, val] of metaRows) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(70, 70, 70)
    doc.text(lbl, rightColX, rightY)

    doc.setFont("helvetica", "normal")
    doc.setTextColor(0, 0, 0)
    const valLines = doc.splitTextToSize(String(val || "—"), rightValWidth)
    doc.text(valLines, rightValX, rightY)

    rightY += Math.max(3.4, valLines.length * 3.1 + 0.3)
  }

  // -----------------------------------------------------------------
  // 2. BANNER: QUOTATION & Pure Numeric Code
  // -----------------------------------------------------------------
  const bannerY = Math.max(leftY, rightY) + 5

  doc.setFont("helvetica", "bolditalic")
  doc.setFontSize(11)
  doc.setTextColor(0, 32, 96) // Navy Blue
  doc.text("QUOTATION", margin + contentWidth / 2 - 8, bannerY, { align: "center" })

  const rawCode = String(quotation?.quotationCode || quotation?.code || "—").trim()
  const numericCodeMatch = rawCode.match(/\d+$/)
  const displayCode = numericCodeMatch ? numericCodeMatch[0].padStart(5, "0") : rawCode

  doc.setFont("helvetica", "bolditalic")
  doc.setFontSize(9)
  doc.setTextColor(0, 32, 96)
  doc.text("No.", margin + contentWidth - 28, bannerY)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(0, 32, 96)
  doc.text(displayCode, margin + contentWidth, bannerY, { align: "right" })

  const codeWidth = doc.getTextWidth(displayCode)
  doc.setLineWidth(0.3)
  doc.setDrawColor(0, 32, 96)
  doc.line(margin + contentWidth - codeWidth - 1, bannerY + 1.2, margin + contentWidth, bannerY + 1.2)

  // -----------------------------------------------------------------
  // 3. ITEMS TABLE (Dual Pricing: Regular Price/Amount vs Cash Promo/Amount)
  // -----------------------------------------------------------------
  const tableStartY = bannerY + 6
  const tableHead = [["ITEM CODE", "ITEM DESCRIPTION", "QTY.", "REGULAR PRICE", "REGULAR AMOUNT", "CASH PROMO", "CASH AMOUNT"]]

  const termRate = Number(options.installmentCalculation?.termBasis || 0.96)
  const items = quotation?.items || []
  const tableBody = items.map((item) => {
    const itemCode = item.itemCodeSnapshot || item.item?.itemCode || "—"
    const desc = item.description || item.item?.itemName || "Item"
    const qty = Number(item.quantity || 0)
    const cashUnit = Number(item.unitPrice ?? item.baseUnitPrice ?? 0)
    const cashTotal = Number(item.lineTotal ?? (qty * cashUnit - (Number(item.discountAmount) || 0)))
    const regUnit = Math.round((cashUnit / termRate) * 100) / 100
    const regTotal = Math.round((cashTotal / termRate) * 100) / 100

    return [
      itemCode,
      desc,
      String(qty),
      regUnit.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      regTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      cashUnit.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      cashTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ]
  })

  autoTable(doc, {
    startY: tableStartY,
    head: tableHead,
    body: tableBody,
    theme: "plain",
    margin: { left: margin, right: margin },
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
      textColor: [0, 0, 0],
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fontStyle: "bold",
      textColor: [0, 0, 0],
      fontSize: 7.5,
      lineWidth: { top: 0.7, bottom: 0.7 },
      lineColor: [0, 0, 0],
      cellPadding: { top: 1.8, bottom: 1.8, left: 1, right: 1 },
    },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: "bold" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 10, halign: "center" },
      3: { cellWidth: 23, halign: "right" },
      4: { cellWidth: 23, halign: "right" },
      5: { cellWidth: 23, halign: "right" },
      6: { cellWidth: 24, halign: "right", fontStyle: "bold" },
    },
  })

  let finalY = doc.lastAutoTable?.finalY || tableStartY + 20

  doc.setLineWidth(0.6)
  doc.setDrawColor(0, 0, 0)
  doc.line(margin, finalY + 1, margin + contentWidth, finalY + 1)
  doc.line(margin, finalY + 1.8, margin + contentWidth, finalY + 1.8)

  finalY += 4

  // -----------------------------------------------------------------
  // 4. TOTALS & PRICING SUMMARY (Dual Total: Regular & Cash Promo)
  // -----------------------------------------------------------------
  const cashPromoTotal = Number(quotation?.grandTotal || quotation?.subtotal || 0)
  const srpTotal = Math.round((cashPromoTotal / 0.96) * 100) / 100
  const regularTotal = Math.round((cashPromoTotal / termRate) * 100) / 100

  // Left: Warranty & PC Build Disclaimers (Exactly matching Excel Rows 22-23, 50-52)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)

  let noteY = finalY + 3
  const isPcBuild = quotation?.isPcBuild || options?.isPcBuild
  if (isPcBuild) {
    doc.text("(FREE PC BUILD, CABLE MANAGEMENT & ESSENTIAL APP INSTALLATION)", margin, noteY)
    noteY += 3.4
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.text(
      "Exclusive to complete PC builds purchased from us. Not applicable to individual component purchases.",
      margin,
      noteY
    )
    noteY += 4.5
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
  }

  doc.text("ONE (1) YEAR WARRANTY ON MAJOR PARTS & ONE (1) MONTH ON ACCESSORIES", margin, noteY)
  noteY += 3.4
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.text(
    "COMPLETE BOX & INCLUSIONS (7 DAYS OUTRIGHT REPLACEMENT EXCEPT FOR PRINTERS)",
    margin,
    noteY
  )
  noteY += 3.6
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(150, 0, 0)
  doc.text(
    "CASH DISCOUNTED PRICE APPLIES ONLY FOR CASH, GCASH, BANK TRANSFER",
    margin,
    noteY
  )

  // Right: Price breakdown
  const totalsLabelX = margin + contentWidth - 75
  const totalsValueX = margin + contentWidth

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 0)

  doc.text("TOTAL CASH PROMO", totalsLabelX, finalY + 4)
  doc.text(
    cashPromoTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    totalsValueX,
    finalY + 4,
    { align: "right" }
  )

  doc.text("REGULAR PRICE", totalsLabelX, finalY + 8.5)
  doc.text(
    regularTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    totalsValueX,
    finalY + 8.5,
    { align: "right" }
  )

  // If specific installment calculation provided in options
  if (options.installmentCalculation) {
    const calc = options.installmentCalculation
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(0, 32, 96)
    doc.text(`SELECTED AR (${calc.months} MOS):`, totalsLabelX, finalY + 13)
    doc.text(
      `${calc.monthlyDueAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo`,
      totalsValueX,
      finalY + 13,
      { align: "right" }
    )
  }

  finalY = Math.max(noteY + 8, finalY + 23)

  // -----------------------------------------------------------------
  // 5. SIGNATURES SECTION (Prepared by & Conforme matching Excel Rows 56-59)
  // -----------------------------------------------------------------
  const leftSigX = margin
  const rightSigX = margin + contentWidth - 75

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  doc.text("Prepared by:", leftSigX, finalY)
  doc.text("CONFORME:", rightSigX, finalY)

  doc.setLineWidth(0.3)
  doc.line(leftSigX, finalY + 12, leftSigX + 65, finalY + 12)
  doc.line(rightSigX, finalY + 12, rightSigX + 75, finalY + 12)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(60, 60, 60)
  doc.text(String(salesman).toUpperCase(), leftSigX + 32.5, finalY + 15.5, { align: "center" })
  doc.text("Signature over Printed Name/ Date", rightSigX + 37.5, finalY + 15.5, { align: "center" })

  if (options.autoPrint) {
    doc.autoPrint()
    const pdfUrl = doc.output("bloburl")
    const printWindow = window.open(pdfUrl, "_blank")
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.focus()
        printWindow.print()
      }
    } else {
      doc.save(`Quotation_${displayCode}.pdf`)
    }
    return
  }

  doc.save(`Quotation_${displayCode}.pdf`)
}

export function printCustomerQuotation(quotation, options = {}) {
  exportCustomerQuotationPdf(quotation, { ...options, autoPrint: true })
}

export function exportPurchaseOrderPdf(order, context) {
  exportBusinessPdf(purchaseOrderDocument(order, context))
}

export function printPurchaseOrder(order, context) {
  printBusinessDocument(
    purchaseOrderDocument(order, context),
  )
}

export function exportReceivingPdf(receiving, context) {
  exportBusinessPdf(receivingDocument(receiving, context))
}

export function printReceiving(receiving, context) {
  printBusinessDocument(
    receivingDocument(receiving, context),
  )
}

export function exportInventoryPdf(items, context) {
  exportBusinessPdf(inventoryDocument(items, context))
}

export function exportReportPdf(options) {
  exportBusinessPdf(reportDocument(options))
}

export function printReport(options) {
  printBusinessDocument(reportDocument(options))
}


