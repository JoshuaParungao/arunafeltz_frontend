/**
 * Utility to persist and retrieve payment/settlement preferences in Quotation notes
 * without modifying database schema or polluting customer-facing printed documents.
 */

const SETTLEMENT_REGEX = /<!--SETTLEMENT:([\s\S]*?)-->/

/**
 * Packs user remarks and settlement configuration into a notes string.
 */
export function serializeQuotationNotes(userRemarks = "", settlementConfig = {}) {
  const cleanRemarks = stripSettlementTag(userRemarks).trim()
  if (!settlementConfig || Object.keys(settlementConfig).length === 0) {
    return cleanRemarks || undefined
  }

  const payload = JSON.stringify(settlementConfig)
  const tag = `<!--SETTLEMENT:${payload}-->`

  return cleanRemarks ? `${cleanRemarks}\n${tag}` : tag
}

/**
 * Extracts the settlement configuration from quotation notes.
 */
export function parseQuotationSettlement(notes = "") {
  if (!notes || typeof notes !== "string") return null
  const match = notes.match(SETTLEMENT_REGEX)
  if (!match || !match[1]) return null

  try {
    return JSON.parse(match[1].trim())
  } catch (err) {
    console.warn("Failed to parse quotation settlement config from notes:", err)
    return null
  }
}

/**
 * Removes the settlement tag from notes for clean customer display or PDF export.
 */
export function stripSettlementTag(notes = "") {
  if (!notes || typeof notes !== "string") return ""
  return notes.replace(SETTLEMENT_REGEX, "").trim()
}
