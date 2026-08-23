export function findSettingByKey(settings, key) {
  return settings.find((setting) => setting.key === key) || null
}

export function getSettingsByCategory(settings, category) {
  return settings.filter((setting) => setting.category === category)
}

export function formatSettingValue(value) {
  if (value === null || value === undefined) return "Not set"

  if (typeof value === "boolean") {
    return value ? "Enabled" : "Disabled"
  }

  if (Array.isArray(value)) {
    return value.join(", ")
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, itemValue]) => `${formatTermLabel(key)}: ${itemValue}`)
      .join("\n")
  }

  return String(value)
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
  }

  return names[setting.key] || setting.label || "Business Setting"
}

export function getFriendlySettingDescription(setting) {
  const descriptions = {
    "installment.balance_formula": "How the remaining balance is computed after downpayment.",
    "installment.term_basis": "Rates used when computing installment or credit terms.",
    "quotation.cash_discounted_amount_formula": "How each item amount is computed in quotations.",
    "quotation.total_cash_discounted_price_formula": "How total cash price is computed.",
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
  }

  return descriptions[setting.key] || setting.description || "Saved business setting."
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
