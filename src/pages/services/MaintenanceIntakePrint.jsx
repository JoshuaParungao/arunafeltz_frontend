import {
  ACCESSORIES_OPTIONS,
  extractIntakeRecord,
  PHYSICAL_CONDITIONS,
  REQUESTED_MAINTENANCE_SERVICES,
  SPECIAL_ATTENTION_ITEMS,
  UNIT_TYPES,
} from "./serviceJobForms"

function formatDate(dateValue) {
  if (!dateValue) return ""
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return String(dateValue)
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  const yyyy = date.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

export default function MaintenanceIntakePrint({ job }) {
  const intake = extractIntakeRecord(job) || {}
  const customerName = job.customerNameSnapshot || job.customer?.fullName || "Walk-in"
  const customerAddress = intake.customerAddress || job.customer?.address || "—"
  const customerContact = job.customerContactSnapshot || job.customer?.mobileNumber || job.customer?.email || "—"
  const receivedDate = formatDate(job.receivedAt)
  const receivedByName = job.receivedBy?.fullName || job.createdBy?.fullName || "Staff"

  const selectedUnitType = intake.unitType || "Desktop / System Unit"
  const selectedAccessories = intake.receivedAccessories || []
  const selectedConditions = intake.physicalConditions || []
  const selectedServices = intake.requestedServices || []
  const selectedAttention = intake.specialAttention || []

  return (
    <div className="jo-intake-print-sheet">
      <div className="jo-intake-header-center">
        <h1 className="jo-intake-main-title">MAINTENANCE, UPGRADE & SERVICE INTAKE</h1>
      </div>

      {/* Customer & Unit Information block */}
      <div className="jo-intake-top-fields">
        <div className="jo-intake-row">
          <div className="jo-intake-field-group" style={{ flex: "1 1 65%" }}>
            <span className="jo-intake-field-label jo-bold">Customer Name:</span>
            <span className="jo-intake-field-line jo-bold">{customerName}</span>
          </div>
          <div className="jo-intake-field-group" style={{ flex: "1 1 35%" }}>
            <span className="jo-intake-field-label jo-bold">Date:</span>
            <span className="jo-intake-field-line">{receivedDate}</span>
          </div>
        </div>

        <div className="jo-intake-row">
          <div className="jo-intake-field-group" style={{ width: "100%" }}>
            <span className="jo-intake-field-label jo-bold">Address:</span>
            <span className="jo-intake-field-line">{customerAddress}</span>
          </div>
        </div>

        <div className="jo-intake-row">
          <div className="jo-intake-field-group" style={{ width: "100%" }}>
            <span className="jo-intake-field-label jo-bold">Contact Number:</span>
            <span className="jo-intake-field-line">{customerContact}</span>
          </div>
        </div>

        <div className="jo-intake-row" style={{ marginTop: "4px" }}>
          <span className="jo-intake-field-label jo-bold">Unit Information:</span>
          <span className="jo-intake-field-label" style={{ marginLeft: "12px" }}>Type of Unit (✓):</span>
        </div>

        <div className="jo-intake-unit-type-grid">
          {UNIT_TYPES.map((type) => {
            const isChecked = selectedUnitType === type || (type === "Other" && !UNIT_TYPES.slice(0, 6).includes(selectedUnitType))
            return (
              <label className="jo-intake-check-label" key={type}>
                <span className="jo-print-box">{isChecked ? "☑" : "☐"}</span>
                <span>{type === "Other" && isChecked && selectedUnitType !== "Other" ? `Other: ${selectedUnitType}` : type}</span>
              </label>
            )
          })}
        </div>

        <div className="jo-intake-row" style={{ marginTop: "6px" }}>
          <div className="jo-intake-field-group" style={{ flex: "1 1 50%" }}>
            <span className="jo-intake-field-label jo-bold">Brand & Model:</span>
            <span className="jo-intake-field-line jo-bold">{intake.brandModel || job.deviceDescription || "—"}</span>
          </div>
          <div className="jo-intake-field-group" style={{ flex: "1 1 50%" }}>
            <span className="jo-intake-field-label jo-bold">Serial Number (if available):</span>
            <span className="jo-intake-field-line">{intake.serialNumber || job.serialNumber || "—"}</span>
          </div>
        </div>
      </div>

      {/* Requested Service Section */}
      <div className="jo-intake-section">
        <div className="jo-intake-section-title jo-bold">Requested Service:</div>
        <div className="jo-intake-grid-3" style={{ marginTop: "3px" }}>
          {REQUESTED_MAINTENANCE_SERVICES.map((srv) => {
            const isChecked = selectedServices.includes(srv)
            return (
              <label className="jo-intake-check-label" key={srv}>
                <span className="jo-print-box">{isChecked ? "☑" : "☐"}</span>
                <span>{srv === "Other" && isChecked && intake.otherRequestedService ? `Other: ${intake.otherRequestedService}` : srv}</span>
              </label>
            )
          })}
        </div>
        <div className="jo-intake-row" style={{ marginTop: "6px" }}>
          <span className="jo-intake-field-label jo-bold">Customer Requests:</span>
          <span className="jo-intake-field-line" style={{ flex: 1, marginLeft: "8px" }}>
            {intake.otherRequestedService || intake.problemSymptoms || job.problemDescription || "—"}
          </span>
        </div>
      </div>

      {/* Maintenance History */}
      <div className="jo-intake-section">
        <div className="jo-intake-section-title jo-bold">Maintenance History:</div>

        <div className="jo-intake-q-block">
          <p className="jo-intake-q-text jo-bold">1. Is this the first time this unit has undergone maintenance or preventive cleaning?</p>
          <div className="jo-intake-radio-row">
            <span className="jo-intake-check-item">
              <span className="jo-print-box">{intake.firstTimeMaintenance?.includes("Yes") ? "☑" : "☐"}</span> Yes (First Maintenance)
            </span>
            <span className="jo-intake-check-item" style={{ marginLeft: "24px" }}>
              <span className="jo-print-box">{intake.firstTimeMaintenance === "No" ? "☑" : "☐"}</span> No
            </span>
          </div>
        </div>

        <div className="jo-intake-q-block" style={{ marginTop: "4px" }}>
          <p className="jo-intake-q-text">
            <strong>2. If NO,</strong> how many times has this unit been maintained or cleaned?
            <span className="jo-inline-underline" style={{ minWidth: "120px", marginLeft: "8px", display: "inline-block" }}>
              {intake.numTimesMaintained ? `${intake.numTimesMaintained} Time(s)` : "—"}
            </span>
          </p>
        </div>

        <div className="jo-intake-q-block" style={{ marginTop: "4px" }}>
          <p className="jo-intake-q-text jo-bold">3. When was the last maintenance performed?</p>
          <div className="jo-intake-flex-row" style={{ marginTop: "2px", gap: "16px" }}>
            {["Less than 6 months ago", "6–12 months ago", "More than 1 year ago", "Unknown"].map((opt) => (
              <span className="jo-intake-check-item" key={opt}>
                <span className="jo-print-box">{intake.lastMaintenanceWhen === opt ? "☑" : "☐"}</span> {opt}
              </span>
            ))}
          </div>
        </div>

        <div className="jo-intake-q-block" style={{ marginTop: "4px" }}>
          <p className="jo-intake-q-text jo-bold">4. Who performed the previous maintenance?</p>
          <div className="jo-intake-flex-row" style={{ marginTop: "2px", gap: "16px" }}>
            {["Our Shop", "Another Repair Shop", "Self-Maintenance", "Unknown"].map((opt) => (
              <span className="jo-intake-check-item" key={opt}>
                <span className="jo-print-box">{intake.lastMaintenanceWho === opt ? "☑" : "☐"}</span> {opt}
              </span>
            ))}
          </div>
        </div>

        <div className="jo-intake-q-block" style={{ marginTop: "4px" }}>
          <p className="jo-intake-q-text jo-bold">5. Were any components upgraded or replaced during the previous maintenance?</p>
          <div className="jo-intake-radio-row">
            <span className="jo-intake-check-item">
              <span className="jo-print-box">{intake.upgradedDuringMaintenance !== "Yes" ? "☑" : "☐"}</span> No
            </span>
            <span className="jo-intake-check-item" style={{ marginLeft: "24px" }}>
              <span className="jo-print-box">{intake.upgradedDuringMaintenance === "Yes" ? "☑" : "☐"}</span> Yes (Please specify):
              <span className="jo-inline-underline" style={{ minWidth: "180px", marginLeft: "6px", display: "inline-block" }}>{intake.upgradedSpecify || "—"}</span>
            </span>
          </div>
        </div>

        <div className="jo-intake-q-block" style={{ marginTop: "4px" }}>
          <p className="jo-intake-q-text jo-bold">6. Is there anything you want us to pay special attention to during the maintenance?</p>
          <div className="jo-intake-grid-2" style={{ marginTop: "2px" }}>
            {SPECIAL_ATTENTION_ITEMS.map((item) => {
              const isChecked = selectedAttention.includes(item)
              return (
                <label className="jo-intake-check-label" key={item}>
                  <span className="jo-print-box">{isChecked ? "☑" : "☐"}</span>
                  <span>{item === "Other" && isChecked && intake.otherSpecialAttention ? `Other: ${intake.otherSpecialAttention}` : item}</span>
                </label>
              )
            })}
          </div>
        </div>
      </div>

      {/* Customer Authorization */}
      <div className="jo-intake-section jo-intake-declaration-box">
        <div className="jo-intake-section-title jo-bold">Customer Authorization:</div>
        <p className="jo-declaration-text">
          I authorize the requested maintenance/upgrade. I understand additional issues may be found during servicing and I will be contacted before additional repairs. I acknowledge the risk of data loss and confirm I have backed up important files.
        </p>

        <div className="jo-intake-sig-row" style={{ marginTop: "12px" }}>
          <div className="jo-intake-sig-col">
            <div className="jo-sig-underline">{customerName}</div>
            <span className="jo-sig-caption">Customer Signature:</span>
          </div>
          <div className="jo-intake-sig-col" style={{ maxWidth: "160px" }}>
            <div className="jo-sig-underline">{receivedDate}</div>
            <span className="jo-sig-caption">Date:</span>
          </div>
        </div>
      </div>

      {/* FOR SHOP USE ONLY Section */}
      <div className="jo-intake-shop-use-section">
        <div className="jo-shop-use-banner jo-bold">FOR SHOP USE ONLY</div>

        <div className="jo-intake-row" style={{ marginTop: "4px" }}>
          <div className="jo-intake-field-group" style={{ flex: "1 1 60%" }}>
            <span className="jo-intake-field-label">Received By:</span>
            <span className="jo-intake-field-line jo-bold">{receivedByName}</span>
          </div>
          <div className="jo-intake-field-group" style={{ flex: "1 1 40%" }}>
            <span className="jo-intake-field-label">Date Received:</span>
            <span className="jo-intake-field-line">{receivedDate}</span>
          </div>
        </div>

        <div className="jo-intake-q-block" style={{ marginTop: "4px" }}>
          <p className="jo-intake-q-text jo-bold">Accessories Included:</p>
          <div className="jo-intake-flex-row" style={{ marginTop: "2px", gap: "16px" }}>
            {ACCESSORIES_OPTIONS.map((acc) => {
              const isChecked = selectedAccessories.includes(acc)
              return (
                <span className="jo-intake-check-item" key={acc}>
                  <span className="jo-print-box">{isChecked ? "☑" : "☐"}</span>
                  <span>{acc === "Others" && intake.otherAccessories ? `Others: ${intake.otherAccessories}` : acc}</span>
                </span>
              )
            })}
          </div>
        </div>

        <div className="jo-intake-q-block" style={{ marginTop: "4px" }}>
          <p className="jo-intake-q-text jo-bold">Initial Physical Condition:</p>
          <div className="jo-intake-grid-4" style={{ marginTop: "2px" }}>
            {PHYSICAL_CONDITIONS.map((cond) => {
              const isChecked = selectedConditions.includes(cond)
              return (
                <span className="jo-intake-check-item" key={cond}>
                  <span className="jo-print-box">{isChecked ? "☑" : "☐"}</span>
                  <span>{cond === "Other Notes" && intake.otherConditionNotes ? `Other Notes: ${intake.otherConditionNotes}` : cond}</span>
                </span>
              )
            })}
          </div>
        </div>

        <div className="jo-intake-row" style={{ marginTop: "6px" }}>
          <div className="jo-intake-field-group" style={{ width: "100%" }}>
            <span className="jo-intake-field-label jo-bold" style={{ fontSize: "12px" }}>Job Order No.:</span>
            <span className="jo-intake-field-line jo-bold" style={{ fontSize: "14px", color: "var(--color-maroon)" }}>{job.jobCode}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
