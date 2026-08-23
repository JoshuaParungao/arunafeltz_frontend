export function findSettingByKey(settings, key) {
  return settings.find((setting) => setting.key === key) || null
}

export function getSettingsByCategory(settings, category) {
  return settings.filter((setting) => setting.category === category)
}

export function formatSettingValue(value) {
  if (value === null || value === undefined) return "Not set"

  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }

  if (Array.isArray(value)) {
    return value.join(", ")
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2)
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
