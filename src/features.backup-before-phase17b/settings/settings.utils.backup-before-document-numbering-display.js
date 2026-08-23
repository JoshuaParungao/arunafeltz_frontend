export function findSettingByKey(settings, key) {
  return settings.find((setting) => setting.key === key) || null
}

export function getSettingsByCategory(settings, category) {
  return settings.filter((setting) => setting.category === category)
}

export function formatTermLabel(termKey) {
  const labels = {
    STRAIGHT: "Straight",
    MONTH_3: "3 months",
    MONTH_6: "6 months",
    MONTH_9: "9 months",
    MONTH_12: "12 months",
    MONTH_18: "18 months",
    MONTH_24: "24 months",
  }

  return labels[termKey] || termKey
}

export function formatReadableText(value) {
  if (!value) return ""

  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function formatSettingValue(value) {
  if (value === null || value === undefined) return "Not set"

  if (typeof value === "boolean") {
    return value ? "Enabled" : "Disabled"
  }

  if (Array.isArray(value)) {
    return value.join("\n")
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, itemValue]) => `${formatTermLabel(key)} — ${itemValue}`)
      .join("\n")
  }

  return formatReadableText(String(value))
}

export function getFriendlySettingName(setting) {
  const names = {
    "installment.balance_formula": "Installment Balance Computation",
    "installment.term_basis": "Installment Rates",
    "quotation.cash_discounted_amount_formula": "Item Amount Computation",
    "quotation.total_cash_discounted_price_formula": "Total Cash Price Computation",
    "quotation.suggested_retail_price_basis": "Suggested Retail Price Basis",
    "quotation.regular_price_basis": "Regular Price Basis",
    "warranty.accessories_days": "Accessories Warranty",
    "warranty.major_parts_months": "Major Parts Warranty",
    "warranty.outright_replacement_days": "Outright Replacement Period",
    "cash_box.default_payment_status": "Default Payment Status",
    "cash_box.require_handover_confirmation": "Cash Handover Confirmation",
    "receipt.business_name": "Receipt Business Name",
    "receipt.default_footer_notes": "Receipt Footer Notes",
    "system.allow_branch_specific_settings": "Branch-Specific Settings",
    "payment.methods": "Payment Methods",
    "price.tier_labels": "Price Tier Labels",
    "discount.rules": "Discount Rules",
    "inventory.rules": "Inventory Rules",
    "service.rules": "Service Rules",
    "incentive.rules": "Incentive Rules",
  }

  return names[setting.key] || setting.label || "Business Setting"
}

export function getFriendlySettingDescription(setting) {
  const descriptions = {
    "installment.balance_formula": "How the remaining balance is computed after downpayment.",
    "installment.term_basis": "Rates used when computing installment or credit terms.",
    "quotation.cash_discounted_amount_formula": "How each item amount is computed in quotations.",
    "quotation.total_cash_discounted_price_formula": "How the total cash price is computed.",
    "quotation.suggested_retail_price_basis": "Basis used for suggested retail price computation.",
    "quotation.regular_price_basis": "Basis used for regular price computation.",
    "warranty.accessories_days": "Default warranty duration for accessories.",
    "warranty.major_parts_months": "Default warranty duration for major parts.",
    "warranty.outright_replacement_days": "Default outright replacement period.",
    "cash_box.default_payment_status": "Default status after staff records a payment.",
    "cash_box.require_handover_confirmation": "Requires confirmation before collection is treated as received.",
    "receipt.business_name": "Business name shown on receipts and printable documents.",
    "receipt.default_footer_notes": "Default notes shown at the bottom of receipts.",
    "system.allow_branch_specific_settings": "Allows selected settings to have branch-level values later.",
    "payment.methods": "Controls accepted payment methods and required payment details.",
    "price.tier_labels": "Controls display names for item price tiers used in POS, quotations, and inventory.",
    "discount.rules": "Controls discount rules shown in POS and quotations.",
    "inventory.rules": "Controls inventory safeguards, adjustment rules, and low-stock alert display.",
    "service.rules": "Controls service job requirements and backend-enforced service safeguards.",
    "incentive.rules": "Controls future incentive display and payout safeguards. Incentive computation module is not active yet.",
  }

  return descriptions[setting.key] || setting.description || "Saved business setting."
}

export function getFriendlySettingValue(setting) {
  const values = {
    "installment.balance_formula":
      "Cash promo total minus cash downpayment, then divided by the selected term basis.",
    "quotation.cash_discounted_amount_formula":
      "Quantity multiplied by Cash Discounted Price.",
    "quotation.total_cash_discounted_price_formula":
      "Sum of all item amounts.",
  }

  if (values[setting.key]) return values[setting.key]

  return formatSettingValue(setting.value)
}

export function getFriendlyGroupName(category) {
  const groups = {
    BUSINESS_RULE: "Business Computation Settings",
    OPERATION: "Operation Settings",
    DOCUMENT: "Document Settings",
    SYSTEM_ADMIN: "System Preferences",
  }

  return groups[category] || "Other Settings"
}

export function groupSettingsForDisplay(settings) {
  return settings.reduce((groups, setting) => {
    const groupName = getFriendlyGroupName(setting.category)

    if (!groups[groupName]) {
      groups[groupName] = []
    }

    groups[groupName].push(setting)
    return groups
  }, {})
}

