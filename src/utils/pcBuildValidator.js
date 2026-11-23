/**
 * PC Build System Unit Completeness Validator
 *
 * Validates that a PC Build contains hardware components for a desktop system unit.
 * Core system unit component categories:
 * 1. CPU / Processor
 * 2. Motherboard
 * 3. RAM / Memory
 * 4. Storage (SSD / NVMe / HDD)
 * 5. Power Supply Unit (PSU)
 * 6. PC Case / Chassis
 *
 * Business Rule: A PC build is valid and ready for checkout if at least 3 of the 6
 * core components are present (or if a complete pre-built system package is in the cart).
 * Explicitly excludes peripherals (Monitor, Keyboard, Mouse, Speakers, Headsets)
 * from being required.
 */

export const CORE_SYSTEM_UNIT_PARTS = [
  { key: "cpu", name: "Processor / CPU", shortName: "CPU" },
  { key: "motherboard", name: "Motherboard", shortName: "Mobo" },
  { key: "ram", name: "RAM / Memory", shortName: "RAM" },
  { key: "storage", name: "Storage (SSD / HDD)", shortName: "Storage" },
  { key: "psu", name: "Power Supply (PSU)", shortName: "PSU" },
  { key: "case", name: "PC Case / Chassis", shortName: "Case" },
]

export const MIN_REQUIRED_CORE_COMPONENTS = 3

/**
 * Detects whether a cart line or item represents one of the core or optional PC build components.
 * Checks category taxonomy, parent category, and keyword heuristics in name/description.
 *
 * @param {Object} lineOrItem - Cart line or product item object
 * @returns {"cpu" | "motherboard" | "ram" | "storage" | "psu" | "case" | "gpu" | "cooling" | "package" | null}
 */
export function detectPartType(lineOrItem) {
  if (!lineOrItem) return null

  // Ignore service/labor or job order lines
  if (lineOrItem.type === "SERVICE" || lineOrItem.isJobOrder) return null

  const item = lineOrItem.item || lineOrItem

  const categoryCode = String(
    item.category?.categoryCode ||
    item.categoryCode ||
    ""
  ).toUpperCase()

  const parentCategoryCode = String(
    item.category?.parent?.categoryCode ||
    item.parentCategoryCode ||
    ""
  ).toUpperCase()

  const categoryName = String(
    item.category?.name ||
    item.categoryName ||
    item.category?.parent?.name ||
    ""
  ).toLowerCase()

  const itemName = String(item.itemName || lineOrItem.itemNameSnapshot || "").toLowerCase()
  const desc = String(item.description || lineOrItem.description || "").toLowerCase()
  const brand = String(item.brand || "").toLowerCase()
  const model = String(item.modelName || "").toLowerCase()
  const fullText = `${categoryName} ${itemName} ${desc} ${brand} ${model}`

  // Check for pre-built complete desktop / system unit package
  if (
    fullText.includes("system unit package") ||
    fullText.includes("desktop package") ||
    fullText.includes("pre-built pc") ||
    fullText.includes("prebuilt pc") ||
    fullText.includes("complete pc set")
  ) {
    return "package"
  }

  // 1. CPU / Processor
  const isCoolingCategory =
    categoryCode.includes("COOL") ||
    parentCategoryCode.includes("COOL") ||
    categoryName.includes("cooling")

  const hasCpuModel = /\b(ryzen\s*[3579]|core\s*i[3579]|core\s*ultra|intel\s*core|athlon\s*\d+|pentium\s*gold|celeron\s*g|threadripper|xeon|epyc)\b/i.test(
    fullText
  )

  const isCoolerOnly =
    (fullText.includes("liquid cool") ||
      fullText.includes("aio ") ||
      fullText.includes("heatsink") ||
      fullText.includes("thermal paste") ||
      fullText.includes("case fan") ||
      /\b(mounting\s*bracket|cooler\s*for|am[45]\s*bracket|lga\s*bracket)\b/i.test(fullText)) &&
    !categoryCode.startsWith("CAT-CPU") &&
    !hasCpuModel

  if (!isCoolerOnly && !isCoolingCategory) {
    if (
      categoryCode.startsWith("CAT-CPU") ||
      parentCategoryCode.startsWith("CAT-CPU") ||
      categoryName === "cpu / processor" ||
      categoryName === "desktop cpu" ||
      categoryName === "processor"
    ) {
      return "cpu"
    }

    if (
      hasCpuModel ||
      (/\bprocessor\b/i.test(fullText) && !/\b(fan|cooler|bracket)\b/i.test(fullText))
    ) {
      return "cpu"
    }
  }

  // 2. Motherboard
  if (
    categoryCode.startsWith("CAT-MOBO") ||
    parentCategoryCode.startsWith("CAT-MOBO") ||
    categoryName.includes("motherboard") ||
    categoryName.includes("mainboard")
  ) {
    return "motherboard"
  }
  if (
    /\b(motherboard|mainboard|mobo)\b/i.test(fullText) ||
    /\b(b450|b550|b650|b650e|x570|x670|x670e|x870|x870e|a320|a520|a620|h310|h410|h510|h610|b360|b365|b460|b560|b660|b760|b860|z390|z490|z590|z690|z790|z890)[a-z0-9\-]*\b/i.test(
      fullText
    ) ||
    (/\b(gigabyte|asus|msi|asrock|colorful|biostar|maxsun)\b/i.test(fullText) &&
      /\b(lga\s*\d+|am[45]|socket)\b/i.test(fullText) &&
      /\b(dimm|ddr[45]|m-atx|matx|atx)\b/i.test(fullText) &&
      !/\b(ram|memory|ddr[45]\s*ram)\b/i.test(fullText))
  ) {
    return "motherboard"
  }

  // 3. Storage (Internal SSD, NVMe, HDD) - Checked BEFORE RAM brand heuristics
  const isUsbDrive =
    categoryCode === "CAT-STRG-USB" ||
    fullText.includes("flash drive") ||
    fullText.includes("thumb drive") ||
    fullText.includes("otg drive")

  const isExplicitStorage =
    /\b(nvme|m\.2\s*ssd|sata\s*ssd|solid\s*state\s*drive|internal\s*ssd|hard\s*disk\s*drive|barracuda|skyhawk|ironwolf|wd\s*blue|wd\s*black|wd\s*green|kc3000|kingston\s*nv[23]|samsung\s*9[789]0|samsung\s*870)\b/i.test(
      fullText
    ) ||
    (/\b(ssd|hdd|sata\s*iii|2\.5["\s]*ssd|m\.2)\b/i.test(fullText) &&
      /\b(\d+gb|\d+tb|nand)\b/i.test(fullText))

  if (!isUsbDrive) {
    if (
      categoryCode.startsWith("CAT-STORAGE") ||
      categoryCode.startsWith("CAT-STRG") ||
      parentCategoryCode.startsWith("CAT-STORAGE") ||
      parentCategoryCode.startsWith("CAT-STRG") ||
      categoryName.includes("storage") ||
      categoryName.includes("solid state drive") ||
      categoryName.includes("hard disk") ||
      isExplicitStorage
    ) {
      return "storage"
    }
  }

  // 4. RAM / Memory
  if (
    categoryCode.startsWith("CAT-RAM") ||
    parentCategoryCode.startsWith("CAT-RAM") ||
    categoryName.includes("ram") ||
    categoryName.includes("memory")
  ) {
    return "ram"
  }
  if (
    /\b(so-?dimm|udimm)\b/i.test(fullText) ||
    (/\b(ram|memory)\b/i.test(fullText) && /\b(\d+gb|\d+mhz)\b/i.test(fullText)) ||
    (/\bddr[345]\b/i.test(fullText) &&
      /\b(\d+gb|\d+mhz)\b/i.test(fullText) &&
      !/\b(motherboard|mainboard|mobo|gddr)\b/i.test(fullText)) ||
    /\b(trident\s*z|vengeance\s*lpx|vengeance\s*rgb|fury\s*beast|delta\s*rgb|ripjaws|xpg\s*lancer)\b/i.test(
      fullText
    )
  ) {
    return "ram"
  }

  // 5. Power Supply (PSU)
  if (
    categoryCode.startsWith("CAT-PSU") ||
    parentCategoryCode.startsWith("CAT-PSU") ||
    categoryName.includes("power supply") ||
    categoryName.includes("psu")
  ) {
    return "psu"
  }
  if (
    /\b(power\s*supply|psu)\b/i.test(fullText) ||
    (/\b(80\s*plus|80\+|bronze|gold|silver|titanium|modular)\b/i.test(fullText) &&
      /\b\d{3,4}\s*w(att)?\b/i.test(fullText)) ||
    /\b(cv[45678]50|mag\s*a[5678]50|rm[678]50|mwe\s*(450|550|650|750)|toughpower|smart\s*bx1)\b/i.test(
      fullText
    )
  ) {
    return "psu"
  }

  // 6. PC Case / Chassis
  if (
    categoryCode.startsWith("CAT-CASE") ||
    parentCategoryCode.startsWith("CAT-CASE") ||
    categoryName.includes("chassis") ||
    categoryName.includes("pc case") ||
    categoryName === "case"
  ) {
    return "case"
  }
  if (
    /\b(pc\s*case|chassis|casing|gaming\s*case|mid\s*tower|mini\s*tower|full\s*tower|atx\s*case|matx\s*case|itx\s*case)\b/i.test(
      fullText
    ) ||
    (/\b(darkflash|tecware|keytech|inplay|rakk|montech|ygt|coolman|trendsonic|ovc)\b/i.test(fullText) &&
      /\b(case|chassis|tower|tg|side\s*hinge|mesh\s*front|side\s*panel|tempered\s*glass|cuirass|nexus|flatline|alpha|forge)\b/i.test(
        fullText
      ) &&
      !/\b(fan|fans|power\s*supply|psu|mousepad|keyboard)\b/i.test(fullText))
  ) {
    return "case"
  }

  // Optional: GPU / Graphics Card
  if (
    categoryCode.startsWith("CAT-GPU") ||
    parentCategoryCode.startsWith("CAT-GPU") ||
    categoryName.includes("graphics card") ||
    categoryName.includes("video card") ||
    categoryName.includes("gpu") ||
    /\b(geforce|radeon\s*rx|rtx\s*\d{4}|gtx\s*\d{4}|graphics\s*card|video\s*card)\b/i.test(
      fullText
    )
  ) {
    return "gpu"
  }

  // Optional: Cooling
  if (
    categoryCode.startsWith("CAT-COOL") ||
    parentCategoryCode.startsWith("CAT-COOL") ||
    categoryName.includes("cooling") ||
    isCoolerOnly
  ) {
    return "cooling"
  }

  return null
}

/**
 * Validates whether the cart contains sufficient components for a functional PC Build.
 * Requires at least 3 of the 6 core components (CPU, Motherboard, RAM, Storage, PSU, Case)
 * or a complete pre-assembled package.
 *
 * @param {Array} cartLines - The array of cart items/lines
 * @returns {{
 *   isComplete: boolean,
 *   corePartsCount: number,
 *   minRequired: number,
 *   presentComponents: Array<{ key: string, name: string, shortName: string }>,
 *   missingComponents: Array<{ key: string, name: string, shortName: string }>,
 *   foundComponents: Record<string, Array<any>>,
 *   hasPackage: boolean,
 *   summaryMessage: string
 * }}
 */
export function validateSystemUnitCompleteness(cartLines = []) {
  const lines = Array.isArray(cartLines) ? cartLines : []

  const found = {
    cpu: [],
    motherboard: [],
    ram: [],
    storage: [],
    psu: [],
    case: [],
    gpu: [],
    cooling: [],
    package: [],
  }

  for (const line of lines) {
    const partType = detectPartType(line)
    if (partType && found[partType]) {
      found[partType].push(line)
    }
  }

  // A pre-assembled package satisfies all system unit components
  const hasPackage = found.package.length > 0

  const presentComponents = CORE_SYSTEM_UNIT_PARTS.filter(
    (part) => hasPackage || (found[part.key] && found[part.key].length > 0)
  )
  const missingComponents = CORE_SYSTEM_UNIT_PARTS.filter(
    (part) => !hasPackage && (!found[part.key] || found[part.key].length === 0)
  )

  const corePartsCount = presentComponents.length
  // Rule: At least 3 of the 6 core components (or pre-built package) are required for PC Build checkout
  const isComplete = hasPackage || corePartsCount >= MIN_REQUIRED_CORE_COMPONENTS

  let summaryMessage = ""
  if (!isComplete) {
    const presentNames = presentComponents.map((c) => c.shortName).join(", ")
    summaryMessage = `Incomplete PC Build: Found ${corePartsCount} of minimum ${MIN_REQUIRED_CORE_COMPONENTS} required core parts${presentNames ? ` (${presentNames})` : ""}. Please add at least ${MIN_REQUIRED_CORE_COMPONENTS} core system unit parts (CPU, Motherboard, RAM, Storage, PSU, or Case) before checkout. (Note: Monitor, keyboard, and mouse are optional).`
  }

  return {
    isComplete,
    corePartsCount,
    minRequired: MIN_REQUIRED_CORE_COMPONENTS,
    presentComponents,
    missingComponents,
    foundComponents: found,
    hasPackage,
    summaryMessage,
  }
}
