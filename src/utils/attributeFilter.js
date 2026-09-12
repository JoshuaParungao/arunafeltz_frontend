export const POPULAR_BRANDS = [
  "Asus",
  "MSI",
  "Gigabyte",
  "Kingston",
  "Corsair",
  "G.Skill",
  "TeamGroup",
  "Crucial",
  "Samsung",
  "Seagate",
  "Western Digital",
  "Intel",
  "AMD",
  "Palit",
  "Colorful",
  "DeepCool",
  "Cooler Master",
  "Inplay",
  "DarkFlash",
  "Razer",
  "Logitech",
]

export const CAPACITY_PRESETS = [
  "4GB",
  "8GB",
  "16GB",
  "32GB",
  "64GB",
  "128GB",
  "256GB",
  "500GB",
  "512GB",
  "1TB",
  "2TB",
  "4TB",
  "8TB",
]

export const SPEED_PRESETS = [
  "2400MHz",
  "2666MHz",
  "3200MHz",
  "3600MHz",
  "4800MHz",
  "5200MHz",
  "5600MHz",
  "6000MHz",
  "6400MHz",
  "75Hz",
  "100Hz",
  "144Hz",
  "165Hz",
  "180Hz",
  "240Hz",
]

export const TYPE_PRESETS = [
  "DDR4",
  "DDR5",
  "DDR3",
  "AM4",
  "AM5",
  "LGA1700",
  "LGA1851",
  "LGA1200",
  "NVMe",
  "M.2",
  'SATA 2.5"',
  "PCIe 4.0",
  "PCIe 3.0",
]

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Multi-criteria attribute and specification matcher for items.
 * Evaluates item.attributes JSONB, item.itemName, item.brand, item.modelName, and item.description.
 */
export function matchesItemAttributes(item, { capacity, speed, type, specSearch } = {}) {
  if (!item) return false

  const attrs = item.attributes && typeof item.attributes === "object" ? item.attributes : {}
  const allAttrEntries = Object.entries(attrs)
  const attrStrings = allAttrEntries.map(([k, v]) => `${k} ${v}`).join(" ").toLowerCase()
  const fullItemString = `${item.itemName || ""} ${item.brand || ""} ${item.modelName || ""} ${item.description || ""} ${attrStrings}`.toLowerCase()

  if (capacity) {
    const cap = capacity.trim().toLowerCase()
    const directCap = String(
      attrs["Capacity"] ||
      attrs["Storage Capacity"] ||
      attrs["RAM Capacity"] ||
      attrs["VRAM"] ||
      ""
    ).toLowerCase()

    if (directCap && (directCap === cap || directCap.includes(cap))) {
      // matched directly
    } else {
      const pattern = escapeRegExp(cap)
      const regex = new RegExp(`(^|[^a-zA-Z0-9])${pattern}([^a-zA-Z0-9]|$)`, "i")
      if (!regex.test(fullItemString)) {
        return false
      }
    }
  }

  if (speed) {
    const spd = speed.trim().toLowerCase()
    const directSpeed = String(
      attrs["Speed / Frequency"] ||
      attrs["Speed"] ||
      attrs["Refresh Rate"] ||
      attrs["Frequency"] ||
      ""
    ).toLowerCase()

    if (directSpeed && (directSpeed === spd || directSpeed.includes(spd))) {
      // matched directly
    } else {
      const pattern = escapeRegExp(spd)
      const regex = new RegExp(`(^|[^a-zA-Z0-9])${pattern}([^a-zA-Z0-9]|$)`, "i")
      if (!regex.test(fullItemString)) {
        return false
      }
    }
  }

  if (type) {
    const tp = type.trim().toLowerCase()
    const directType = String(
      attrs["Memory Type"] ||
      attrs["Socket"] ||
      attrs["Interface"] ||
      attrs["Form Factor"] ||
      ""
    ).toLowerCase()

    if (directType && (directType === tp || directType.includes(tp))) {
      // matched directly
    } else {
      const pattern = escapeRegExp(tp)
      const regex = new RegExp(`(^|[^a-zA-Z0-9])${pattern}([^a-zA-Z0-9]|$)`, "i")
      if (!regex.test(fullItemString)) {
        return false
      }
    }
  }

  if (specSearch && specSearch.trim()) {
    const term = specSearch.trim().toLowerCase()
    if (!fullItemString.includes(term)) {
      return false
    }
  }

  return true
}
