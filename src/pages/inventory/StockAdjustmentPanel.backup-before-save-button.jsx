import { createElement as h } from "react"

function formatNumber(value) {
  const number = Number(value || 0)
  return number.toLocaleString("en-PH")
}

export default function StockAdjustmentPanel({
  item,
  batches = [],
  batchId,
  type,
  quantity,
  referenceNo,
  remarks,
  onBatchChange,
  onTypeChange,
  onQuantityChange,
  onReferenceNoChange,
  onRemarksChange,
  onClose,
}) {
  if (!item) return null

  return h(
    "section",
    {
      className:
        "mb-5 rounded-3xl border border-[#7A1F2B]/30 bg-white p-5 shadow-sm",
    },
    h(
      "div",
      {
        className:
          "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
      },
      h(
        "div",
        null,
        h(
          "p",
          {
            className:
              "text-xs font-black uppercase tracking-[0.2em] text-[#7A1F2B]",
          },
          "Selected stock adjustment"
        ),
        h(
          "h3",
          {
            className:
              "mt-2 text-xl font-black text-[var(--color-text-strong)]",
          },
          item.itemName || item.itemCode || "Selected product"
        ),
        h(
          "p",
          {
            className:
              "mt-1 text-sm font-semibold text-[var(--color-muted)]",
          },
          item.itemCode || "No item code"
        )
      ),
      h(
        "button",
        {
          className:
            "rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm font-black text-[var(--color-muted)] transition hover:border-[#7A1F2B] hover:text-[#7A1F2B]",
          onClick: onClose,
          type: "button",
        },
        "Close"
      )
    ),

    h(
      "div",
      {
        className: "mt-5 grid gap-3 sm:grid-cols-2",
      },
      h(
        "div",
        {
          className: "rounded-2xl bg-[var(--color-soft)] p-4",
        },
        h(
          "p",
          {
            className:
              "text-xs font-black uppercase text-[var(--color-muted)]",
          },
          "Batch count"
        ),
        h(
          "p",
          {
            className:
              "mt-1 text-lg font-black text-[var(--color-text-strong)]",
          },
          formatNumber(batches.length)
        )
      ),
      h(
        "div",
        {
          className: "rounded-2xl bg-[var(--color-soft)] p-4",
        },
        h(
          "p",
          {
            className:
              "text-xs font-black uppercase text-[var(--color-muted)]",
          },
          "First available batch"
        ),
        h(
          "p",
          {
            className:
              "mt-1 text-sm font-black text-[var(--color-text-strong)]",
          },
          batches[0]?.batchCode || "No batch loaded"
        ),
        h(
          "p",
          {
            className:
              "mt-1 text-sm font-semibold text-[var(--color-muted)]",
          },
          batches[0]
            ? `Available: ${formatNumber(batches[0].quantityAvailable)}`
            : "Available: 0"
        )
      )
    ),

    h(
      "div",
      {
        className: "mt-5 grid gap-4 lg:grid-cols-2",
      },
      h(
        "label",
        {
          className: "block",
        },
        h(
          "span",
          {
            className:
              "text-sm font-black text-[var(--color-text-strong)]",
          },
          "Batch"
        ),
        h(
          "select",
          {
            className:
              "mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold outline-none focus:border-[#7A1F2B]",
            value: batchId || "",
            onChange: (event) => onBatchChange(event.target.value),
          },
          h("option", { value: "" }, "Choose batch"),
          ...batches.map((batch) =>
            h(
              "option",
              {
                key: batch.id,
                value: batch.id,
              },
              `${batch.batchCode} — Available: ${formatNumber(batch.quantityAvailable)}`
            )
          )
        )
      ),

      h(
        "label",
        {
          className: "block",
        },
        h(
          "span",
          {
            className:
              "text-sm font-black text-[var(--color-text-strong)]",
          },
          "Type"
        ),
        h(
          "select",
          {
            className:
              "mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold outline-none focus:border-[#7A1F2B]",
            value: type,
            onChange: (event) => onTypeChange(event.target.value),
          },
          h("option", { value: "INCREASE" }, "Add stock"),
          h("option", { value: "DECREASE" }, "Deduct stock")
        )
      ),

      h(
        "label",
        {
          className: "block",
        },
        h(
          "span",
          {
            className:
              "text-sm font-black text-[var(--color-text-strong)]",
          },
          "Quantity"
        ),
        h("input", {
          className:
            "mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold outline-none focus:border-[#7A1F2B]",
          min: "1",
          type: "number",
          value: quantity,
          onChange: (event) => onQuantityChange(event.target.value),
        })
      ),

      h(
        "label",
        {
          className: "block",
        },
        h(
          "span",
          {
            className:
              "text-sm font-black text-[var(--color-text-strong)]",
          },
          "Reference No."
        ),
        h("input", {
          className:
            "mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold outline-none focus:border-[#7A1F2B]",
          placeholder: "Optional",
          value: referenceNo,
          onChange: (event) => onReferenceNoChange(event.target.value),
        })
      )
    ),

    h(
      "label",
      {
        className: "mt-4 block",
      },
      h(
        "span",
        {
          className:
            "text-sm font-black text-[var(--color-text-strong)]",
        },
        "Reason"
      ),
      h("textarea", {
        className:
          "mt-2 min-h-24 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold outline-none focus:border-[#7A1F2B]",
        placeholder: "Required later before saving",
        value: remarks,
        onChange: (event) => onRemarksChange(event.target.value),
      })
    ),

    h(
      "p",
      {
        className: "mt-4 text-sm font-bold text-[var(--color-muted)]",
      },
      "Save button is not connected yet. This step only verifies the form fields."
    )
  )
}
