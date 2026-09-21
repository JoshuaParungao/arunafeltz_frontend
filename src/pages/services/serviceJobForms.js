// Utilities and types for Service / Job Order Intakes and Receipts

export const INTAKE_RECORD_HEADER = "[INTAKE_RECORD_V1]:"

export const DEFAULT_SHOP_INFO = {
  name: "ARUNAFELTZ COMPUTER PARTS and ACCESSORIES SHOP",
  address: "Kingspire Business Centre, Km.71, Mac Arthur Highway, San Isidro, City of San Fernando, Pampanga",
  contactNo: "0997-732-7689 / 045-404-0673",
}

export const UNIT_TYPES = [
  "Laptop",
  "Desktop",
  "GPU",
  "Motherboard",
  "MacBook",
  "Printer",
  "Monitor",
  "Smartphone / Tablet",
  "Console",
  "PC Component",
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
      const rest = notes.slice(idx + INTAKE_RECORD_HEADER.length)
      const nextHeaderIdx = rest.search(/\[(SERVICE_TASKS_V1|SERVICE_PARTS_V1)\]:/)
      const jsonStr = nextHeaderIdx !== -1 ? rest.slice(0, nextHeaderIdx).trim() : rest.split("\n\n")[0].trim()
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

export const SERVICE_TASKS_HEADER = "[SERVICE_TASKS_V1]:"
export const SERVICE_PARTS_HEADER = "[SERVICE_PARTS_V1]:"
export const WARRANTY_DURATION_OPTIONS = [0, 7, 15, 30, 60, 90]
export const PARTS_WARRANTY_OPTIONS = [
  "None",
  "7 Days",
  "15 Days",
  "30 Days (1 Month)",
  "90 Days (3 Months)",
  "180 Days (6 Months)",
  "1 Year (Supplier)",
  "2 Years (Supplier)",
]

export function formatWarrantyDuration(days) {
  const normalized = Number(days)
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return "0 Days"
  }
  return `${normalized} Days`
}

export function normalizeWarrantyDays(value) {
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized < 0) {
    return 0
  }
  return Math.max(0, Math.floor(normalized))
}

export function extractServiceTasks(job) {
  if (!job) return []
  const notes = job.serviceNotes || ""
  const idx = notes.indexOf(SERVICE_TASKS_HEADER)
  if (idx !== -1) {
    try {
      const rest = notes.slice(idx + SERVICE_TASKS_HEADER.length)
      const nextHeaderIdx = rest.search(/\[(INTAKE_RECORD_V1|SERVICE_PARTS_V1)\]:/)
      const jsonStr = nextHeaderIdx !== -1 ? rest.slice(0, nextHeaderIdx).trim() : rest.split("\n\n")[0].trim()
      const parsed = JSON.parse(jsonStr)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {
      // ignore parse error
    }
  }

  // Fallback: If no explicit task list is stored yet, synthesize from single job line
  const tech = job.serviceDoneBy || job.assignedTechnician
  const amount = Number(job.baseServiceCharge ?? job.finalServiceCharge ?? job.estimatedServiceCharge ?? 0)
  if (job.jobTitle || amount > 0) {
    return [
      {
        id: `task-primary-${job.id || "1"}`,
        title: job.jobTitle || "General Service",
        amount: amount,
        technicianId: tech?.id || "",
        technicianName: tech?.fullName || "Assigned Technician",
        warrantyDays: 0,
        warrantyDuration: "0 Days",
      },
    ]
  }
  return []
}

export function extractServiceParts(job) {
  if (!job) return []
  const notes = job.serviceNotes || ""
  const idx = notes.indexOf(SERVICE_PARTS_HEADER)
  if (idx !== -1) {
    try {
      const rest = notes.slice(idx + SERVICE_PARTS_HEADER.length)
      const nextHeaderIdx = rest.search(/\[(INTAKE_RECORD_V1|SERVICE_TASKS_V1|BACKJOB_RECORD_V1)\]:/)
      const jsonStr = nextHeaderIdx !== -1 ? rest.slice(0, nextHeaderIdx).trim() : rest.split("\n\n")[0].trim()
      const parsed = JSON.parse(jsonStr)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // ignore parse error
    }
  }
  return []
}

export const BACKJOB_RECORD_HEADER = "[BACKJOB_RECORD_V1]:"

export function extractJobWarranty(job) {
  if (!job) return { warrantyDays: 0, warrantyExpiresAt: null, isUnderWarranty: false, daysRemaining: 0 }

  const intake = extractIntakeRecord(job)
  const intakeWarrantyDays = normalizeWarrantyDays(intake?.serviceWarrantyDays)

  if (typeof job.warrantyDays === "number" || job.warrantyExpiresAt) {
    const warrantyDays = normalizeWarrantyDays(job.warrantyDays) || intakeWarrantyDays
    const warrantyExpiresAt = job.warrantyExpiresAt ? new Date(job.warrantyExpiresAt) : null
    const isUnderWarranty = warrantyExpiresAt ? Date.now() <= warrantyExpiresAt.getTime() : warrantyDays > 0
    const daysRemaining = isUnderWarranty && warrantyExpiresAt
      ? Math.max(0, Math.ceil((warrantyExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0

    return {
      warrantyDays,
      warrantyExpiresAt,
      isUnderWarranty,
      daysRemaining,
    }
  }

  const tasks = extractServiceTasks(job)
  let maxDays = intakeWarrantyDays
  for (const t of tasks) {
    if (typeof t.warrantyDays === "number") {
      maxDays = Math.max(maxDays, t.warrantyDays)
    } else if (t.warrantyDuration) {
      const match = String(t.warrantyDuration).match(/(\d+)/)
      if (match) {
        maxDays = Math.max(maxDays, parseInt(match[1], 10))
      }
    }
  }

  const completionDate = job.releasedAt || job.completedAt
  if (!completionDate || maxDays <= 0) {
    return { warrantyDays: maxDays, warrantyExpiresAt: null, isUnderWarranty: false, daysRemaining: 0 }
  }

  const startTime = new Date(completionDate).getTime()
  const warrantyExpiresAt = new Date(startTime + maxDays * 24 * 60 * 60 * 1000)
  const now = Date.now()
  const isUnderWarranty = now <= warrantyExpiresAt.getTime()
  const daysRemaining = isUnderWarranty
    ? Math.max(0, Math.ceil((warrantyExpiresAt.getTime() - now) / (24 * 60 * 60 * 1000)))
    : 0

  return {
    warrantyDays: maxDays,
    warrantyExpiresAt,
    isUnderWarranty,
    daysRemaining,
  }
}

export function extractBackjobRecord(job) {
  if (!job) return { isBackjob: false, originalJobCode: null, originalJobId: null, reason: "", warrantyDays: 0, warrantyExpiresAt: null }

  if (job.isBackjob) {
    return {
      isBackjob: true,
      originalJobCode: job.parentJobCode || null,
      originalJobId: job.parentJobId || null,
      reason: job.backjobReason || "",
      warrantyDays: normalizeWarrantyDays(job.warrantyDays),
      warrantyExpiresAt: job.warrantyExpiresAt || null,
    }
  }

  const notes = job.serviceNotes || ""
  const idx = notes.indexOf(BACKJOB_RECORD_HEADER)
  if (idx !== -1) {
    try {
      const rest = notes.slice(idx + BACKJOB_RECORD_HEADER.length)
      const nextHeaderIdx = rest.search(/\[(INTAKE_RECORD_V1|SERVICE_TASKS_V1|SERVICE_PARTS_V1)\]:/)
      const jsonStr = nextHeaderIdx !== -1 ? rest.slice(0, nextHeaderIdx).trim() : rest.split("\n\n")[0].trim()
      const parsed = JSON.parse(jsonStr)
      return {
        isBackjob: true,
        originalJobCode: parsed.originalJobCode || null,
        originalJobId: parsed.originalJobId || null,
        reason: parsed.reason || "",
        warrantyDays: normalizeWarrantyDays(parsed.warrantyDays),
        warrantyExpiresAt: parsed.warrantyExpiresAt || null,
      }
    } catch {
      // ignore
    }
  }

  // Fallback heuristic: check jobTitle or notes
  const titleMatch = (job.jobTitle || "").match(/\[BACKJOB(?::\s*([A-Za-z0-9_-]+))?\]/i)
  if (titleMatch) {
    return {
      isBackjob: true,
      originalJobCode: titleMatch[1] || null,
      originalJobId: null,
      reason: "",
      warrantyDays: 0,
      warrantyExpiresAt: null,
    }
  }

  return { isBackjob: false, originalJobCode: null, originalJobId: null, reason: "", warrantyDays: 0, warrantyExpiresAt: null }
}

export function cleanUserNotes(notes) {
  if (!notes) return ""
  return notes
    .replace(/\[(INTAKE_RECORD_V1|SERVICE_TASKS_V1|SERVICE_PARTS_V1|BACKJOB_RECORD_V1)\]:[\s\S]*?(\n\n|$)/g, "")
    .replace(/\[BILLED IN POS:.*?\]/g, "")
    .replace(/\[CLIENT PULL-OUT\]:.*?(\n|$)/g, "")
    .trim()
}

export function serializeStructuredNotes({
  intakeRecord = null,
  tasks = [],
  parts = [],
  freeNotes = "",
  billedInPosTag = "",
  clientPullOutTag = "",
  backjobRecord = null,
}) {
  const partsList = []
  if (intakeRecord) {
    partsList.push(`${INTAKE_RECORD_HEADER}${JSON.stringify(intakeRecord)}`)
  }
  if (backjobRecord) {
    partsList.push(`${BACKJOB_RECORD_HEADER}${JSON.stringify(backjobRecord)}`)
  }
  if (Array.isArray(tasks) && tasks.length > 0) {
    partsList.push(`${SERVICE_TASKS_HEADER}${JSON.stringify(tasks)}`)
  }
  if (Array.isArray(parts) && parts.length > 0) {
    partsList.push(`${SERVICE_PARTS_HEADER}${JSON.stringify(parts)}`)
  }
  if (billedInPosTag) {
    partsList.push(billedInPosTag.trim())
  }
  if (clientPullOutTag) {
    partsList.push(clientPullOutTag.trim())
  }
  const cleanFree = cleanUserNotes(freeNotes)
  if (cleanFree) {
    partsList.push(cleanFree)
  }
  return partsList.join("\n\n")
}

export function getEffectiveJobPaymentState(job) {
  if (!job) {
    return {
      paymentState: "UNPAID",
      remainingBalance: 0,
      collectedAmount: 0,
      isBilledInPos: false,
      posInvoiceCode: null,
      posBilledAmount: 0,
    }
  }

  const finalCharge = Number(
    job.finalServiceCharge ?? job.baseServiceCharge ?? job.estimatedServiceCharge ?? 0
  )
  const directCollected = Number(job.directCollectedAmount || 0)
  const receivableCollected = Number(job.receivableCollectedAmount || 0)

  const posRegex = /\[BILLED IN POS:\s*Invoice\s*([A-Za-z0-9_-]+)(?:\s+Amount:\s*([\d.]+))?\]/gi
  const notesText = [
    job.serviceNotes || "",
    job.releaseNotes || "",
    job.servicePerformed || "",
  ].join("\n")

  const posMatches = [...notesText.matchAll(posRegex)]
  const billedInvoices = []
  let posBilledAmount = 0
  let hasTagWithoutAmount = false

  for (const match of posMatches) {
    const invCode = match[1]
    if (!billedInvoices.includes(invCode)) {
      billedInvoices.push(invCode)
    }
    if (match[2]) {
      posBilledAmount += Number(match[2])
    } else {
      hasTagWithoutAmount = true
    }
  }

  const legacyMatch = (job.releaseNotes || "").match(/via POS invoice\s*([A-Za-z0-9_-]+)/i)
  if (legacyMatch && !billedInvoices.includes(legacyMatch[1])) {
    billedInvoices.push(legacyMatch[1])
    hasTagWithoutAmount = true
  }

  const isBilledInPos = billedInvoices.length > 0
  if (isBilledInPos && posBilledAmount === 0 && hasTagWithoutAmount) {
    posBilledAmount = finalCharge
  }

  const totalCollected = directCollected + receivableCollected + posBilledAmount
  const remainingBalance = Math.max(0, finalCharge - totalCollected)

  let paymentState = job.paymentState
  if (isBilledInPos || totalCollected > 0) {
    paymentState =
      remainingBalance <= 0
        ? "PAID"
        : totalCollected > 0
          ? "PARTIALLY_PAID"
          : "UNPAID"
  }

  return {
    paymentState,
    remainingBalance,
    collectedAmount: totalCollected,
    isBilledInPos,
    posInvoiceCode: billedInvoices.join(", ") || null,
    posBilledAmount,
  }
}

function detectUnitType(deviceDesc = "") {
  const d = deviceDesc.toLowerCase()
  if (d.includes("macbook") || d.includes("imac") || d.includes("apple")) return "MacBook"
  if (d.includes("laptop") || d.includes("notebook")) return "Laptop"
  if (d.includes("desktop") || d.includes("system unit")) return "Desktop"
  if (d.includes("gpu") || d.includes("graphics card") || d.includes("geforce") || d.includes("radeon") || d.includes("rtx") || d.includes("gtx")) return "GPU"
  if (d.includes("motherboard") || d.includes("mobo")) return "Motherboard"
  if (d.includes("printer")) return "Printer"
  if (d.includes("monitor")) return "Monitor"
  if (d.includes("phone") || d.includes("tablet") || d.includes("ipad") || d.includes("android")) return "Smartphone / Tablet"
  if (d.includes("console") || d.includes("playstation") || d.includes("ps4") || d.includes("ps5") || d.includes("switch") || d.includes("xbox")) return "Console"
  if (d.includes("component") || d.includes("ram") || d.includes("psu") || d.includes("ssd") || d.includes("hdd")) return "PC Component"
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
