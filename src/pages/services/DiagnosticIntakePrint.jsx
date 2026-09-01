import {
  ACCESSORIES_OPTIONS,
  extractIntakeRecord,
  PHYSICAL_CONDITIONS,
  PREVIOUS_REPAIR_ACTIONS,
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

export default function DiagnosticIntakePrint({ isBlank = false, job = {} }) {
  const intake = isBlank ? {} : (extractIntakeRecord(job) || {})
  const customerName = isBlank ? "" : (job.customerNameSnapshot || job.customer?.fullName || "Walk-in")
  const customerAddress = isBlank ? "" : (intake.customerAddress || job.customer?.address || "—")
  const customerContact = isBlank ? "" : (job.customerContactSnapshot || job.customer?.mobileNumber || job.customer?.email || "—")
  const receivedDate = isBlank ? "" : formatDate(job.receivedAt)
  const receivedByName = isBlank ? "" : (job.receivedBy?.fullName || job.createdBy?.fullName || "Staff")

  const selectedUnitType = isBlank ? null : (intake.unitType || "Laptop")
  const selectedAccessories = isBlank ? [] : (intake.receivedAccessories || [])
  const selectedConditions = isBlank ? [] : (intake.physicalConditions || [])
  const selectedPreviousRepairs = isBlank ? [] : (intake.previousRepairs || [])

  return (
    <div className="jo-intake-print-sheet">
      <div className="jo-intake-header-center">
        <h1 className="jo-intake-main-title">SERVICE INTAKE & DIAGNOSTIC DECLARATION</h1>
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
            <span className="jo-intake-field-line jo-bold">{isBlank ? "" : (intake.brandModel || job.deviceDescription || "")}</span>
          </div>
          <div className="jo-intake-field-group" style={{ flex: "1 1 50%" }}>
            <span className="jo-intake-field-label jo-bold">Serial Number (if available):</span>
            <span className="jo-intake-field-line">{isBlank ? "" : (intake.serialNumber || job.serialNumber || "")}</span>
          </div>
        </div>
      </div>

      {/* Reported Problem */}
      <div className="jo-intake-section">
        <div className="jo-intake-section-title jo-bold">Reported Problem</div>
        <p className="jo-intake-instruction">Please describe the issue or symptoms you are experiencing:</p>
        <div className="jo-intake-lines-box">
          <p className="jo-intake-text-fill">{isBlank ? "" : (intake.problemSymptoms || job.problemDescription || "")}</p>
        </div>
        <div className="jo-intake-row" style={{ marginTop: "6px" }}>
          <span className="jo-intake-field-label">When did the problem start?</span>
          <span className="jo-intake-field-line" style={{ flex: 1, marginLeft: "8px" }}>{isBlank ? "" : (intake.whenProblemStarted || "")}</span>
        </div>
      </div>

      {/* Previous Repair History */}
      <div className="jo-intake-section">
        <div className="jo-intake-section-title jo-bold">Previous Repair History</div>
        
        <div className="jo-intake-q-block">
          <p className="jo-intake-q-text jo-bold">1. Has this unit been checked, diagnosed, or repaired by another repair shop or technician?</p>
          <div className="jo-intake-radio-row">
            <span className="jo-intake-check-item">
              <span className="jo-print-box">{!isBlank && intake.checkedByOtherShop === "Yes" ? "☑" : "☐"}</span> Yes
            </span>
            <span className="jo-intake-check-item" style={{ marginLeft: "24px" }}>
              <span className="jo-print-box">{!isBlank && intake.checkedByOtherShop === "No" ? "☑" : "☐"}</span> No
            </span>
          </div>
        </div>

        <div className="jo-intake-q-block" style={{ marginTop: "4px" }}>
          <p className="jo-intake-q-text">
            <strong>2. If YES,</strong> how many repair shops or technicians have handled this unit before bringing it to us?
            <span className="jo-inline-underline" style={{ minWidth: "120px", marginLeft: "8px", display: "inline-block" }}>{isBlank ? "" : (intake.numShopsHandled || "")}</span>
          </p>
        </div>

        <div className="jo-intake-q-block" style={{ marginTop: "4px" }}>
          <p className="jo-intake-q-text"><strong>3. Please list the shop(s) or technician(s), if known:</strong></p>
          <div className="jo-intake-field-line" style={{ marginTop: "2px" }}>{isBlank ? "" : (intake.otherShopsList || "")}</div>
        </div>

        <div className="jo-intake-q-block" style={{ marginTop: "6px" }}>
          <p className="jo-intake-q-text jo-bold">4. What repairs, tests, or modifications were previously performed?</p>
          <div className="jo-intake-grid-3" style={{ marginTop: "3px" }}>
            {PREVIOUS_REPAIR_ACTIONS.map((action) => {
              const checked = selectedPreviousRepairs.includes(action)
              return (
                <label className="jo-intake-check-label" key={action}>
                  <span className="jo-print-box">{checked ? "☑" : "☐"}</span>
                  <span>{action === "Other" && checked && intake.otherPreviousRepairs ? `Other: ${intake.otherPreviousRepairs}` : action}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="jo-intake-q-block" style={{ marginTop: "6px" }}>
          <p className="jo-intake-q-text jo-bold">5. Were any components removed, replaced, or modified?</p>
          <div className="jo-intake-radio-row">
            <span className="jo-intake-check-item">
              <span className="jo-print-box">{!isBlank && intake.componentsModified === "Yes" ? "☑" : "☐"}</span> Yes
            </span>
            <span className="jo-intake-check-item" style={{ marginLeft: "24px" }}>
              <span className="jo-print-box">{!isBlank && intake.componentsModified === "No" ? "☑" : "☐"}</span> No
            </span>
          </div>
        </div>
      </div>

      {/* Customer Declaration & Acknowledgement */}
      <div className="jo-intake-section jo-intake-declaration-box">
        <p className="jo-declaration-text">
          I declare that the information provided above is true and complete to the best of my knowledge. I understand that failure to disclose previous repair attempts, modifications, liquid damage, physical damage, or missing components may result in additional diagnostic time.
        </p>
        <p className="jo-ack-title jo-bold" style={{ marginTop: "4px" }}>I acknowledge that:</p>
        <ul className="jo-ack-bullets">
          <li>• Diagnostic turnaround time varies depending on the unit's condition and complexity.</li>
          <li>• Units previously repaired or diagnosed by multiple technicians may require additional testing before an accurate diagnosis can be made.</li>
          <li>• Diagnosis does not guarantee that the unit is repairable.</li>
          <li>• Additional repair charges will only be discussed after the diagnostic process and customer approval.</li>
        </ul>

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
            <span className="jo-intake-field-line jo-bold" style={{ fontSize: "14px", color: "var(--color-maroon)" }}>{isBlank ? "" : job.jobCode}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
