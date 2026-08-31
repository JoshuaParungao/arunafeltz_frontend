// Utilities and types for Service / Job Order Intakes and Receipts

export const INTAKE_RECORD_HEADER = "[INTAKE_RECORD_V1]:"

export const DEFAULT_SHOP_INFO = {
  name: "ARUNAFELTZ COMPUTER PARTS and ACCESSORIES SHOP",
  address: "Kingspire Business Centre, Km.71, Mac Arthur Highway, San Isidro, City of San Fernando, Pampanga",
  contactNo: "0997-732-7689 / 045-404-0673",
}

export const UNIT_TYPES = [
  "Laptop",
  "Desktop / System Unit",
  "Motherboard",
  "Graphics Card (GPU)",
  "Printer",
  "Monitor",
  "Other",
]

export const ACCESSORIES_OPTIONS = [
  "Charger",
  "Battery",
  "Bag",
  "Power Cable",
  "Others",
]

export const PHYSICAL_CONDITIONS = [
  "Good",
  "Cracked Housing/ Broken Parts",
  "Scratches / Cosmetic Damage",
  "Missing Screws",
  "Liquid Damage/ Corrosion",
  "Missing Component",
  "Bent Pins",
  "Burnt Smell/ Marks/ Components",
  "Signs of Previous Repair",
  "Broken Ports / Connectors",
  "Other Notes",
]

export const PREVIOUS_REPAIR_ACTIONS = [
  "Diagnosis Only",
  "GPU Repair",
  "BIOS Programming",
  "Cleaning / Maintenance",
  "Motherboard Repair",
  "Parts Replacement",
  "Other",
]

export const REQUESTED_MAINTENANCE_SERVICES = [
  "General/ Deep Cleaning",
  "Thermal Paste Replacement",
  "RAM Installation/Upgrade",
  "SSD/HDD Upgrade or Replacement",
  "CPU Installation/Upgrade",
  "CPU Cooler Installation/ Upgrade",
  "GPU Installation/Upgrade",
  "PSU Installation/Upgrade",
  "Operating System Installation",
  "Driver/Software Installation",
  "Data Migration (Cloning/Data Backup)",
  "Windows Upgrade",
  "Windows Reformat/ Clean Installation",
  "Printer Cleaning / Maintenance",
  "Performance Optimization",
  "Other",
]

export const SPECIAL_ATTENTION_ITEMS = [
  "High CPU/GPU Temperature",
  "Loud Fan Noise",
  "Slow Performance",
  "Overheating",
  "Frequent Freezing",
  "Dust Build-up",
  "Printer Quality Issue",
  "Other",
]

export function extractIntakeRecord(job) {
  if (!job) return null
  const notes = job.serviceNotes || ""
  const idx = notes.indexOf(INTAKE_RECORD_HEADER)
  if (idx !== -1) {
    try {
      const jsonStr = notes.slice(idx + INTAKE_RECORD_HEADER.length).trim()
      return JSON.parse(jsonStr)
    } catch {
      // ignore parse error
    }
  }

  // If no structured envelope is stored, synthesize an intake object from the job's standard fields
  return {
    intakeType: job.repairType === "BOARD_LEVEL_REPAIR" ? "DIAGNOSTIC" : "MAINTENANCE",
    customerAddress: job.customer?.address || "",
    unitType: detectUnitType(job.deviceDescription),
    brandModel: job.deviceDescription || "",
    serialNumber: job.serialNumber || "",
    problemSymptoms: job.problemDescription || "",
    whenProblemStarted: "",
    checkedByOtherShop: "No",
    numShopsHandled: "",
    otherShopsList: "",
    previousRepairs: [],
    otherPreviousRepairs: "",
    componentsModified: "No",
    receivedAccessories: parseChecklist(job.accessoriesReceived, ACCESSORIES_OPTIONS),
    otherAccessories: extractOtherText(job.accessoriesReceived, ACCESSORIES_OPTIONS),
    physicalConditions: parseChecklist(job.receivingRemarks, PHYSICAL_CONDITIONS),
    otherConditionNotes: extractOtherText(job.receivingRemarks, PHYSICAL_CONDITIONS),
    requestedServices: parseChecklist(job.jobTitle + " " + (job.problemDescription || ""), REQUESTED_MAINTENANCE_SERVICES),
    otherRequestedService: "",
    firstTimeMaintenance: "Yes (First Maintenance)",
    numTimesMaintained: "",
    lastMaintenanceWhen: "",
    lastMaintenanceWho: "",
    upgradedDuringMaintenance: "No",
    upgradedSpecify: "",
    specialAttention: [],
    otherSpecialAttention: "",
  }
}

function detectUnitType(deviceDesc = "") {
  const d = deviceDesc.toLowerCase()
  if (d.includes("laptop") || d.includes("notebook")) return "Laptop"
  if (d.includes("desktop") || d.includes("system unit") || d.includes("pc")) return "Desktop / System Unit"
  if (d.includes("gpu") || d.includes("graphics card") || d.includes("geforce") || d.includes("radeon") || d.includes("rtx") || d.includes("gtx")) return "Graphics Card (GPU)"
  if (d.includes("motherboard") || d.includes("mobo")) return "Motherboard"
  if (d.includes("printer")) return "Printer"
  if (d.includes("monitor")) return "Monitor"
  return "Other"
}

function parseChecklist(text = "", options = []) {
  if (!text) return []
  const lower = text.toLowerCase()
  return options.filter((opt) => lower.includes(opt.toLowerCase().replace(/[()]/g, "").trim()))
}

function extractOtherText(text = "") {
  if (!text) return ""
  return text
}
