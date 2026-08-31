import { DEFAULT_SHOP_INFO, extractIntakeRecord } from "./serviceJobForms"

function formatDate(dateValue) {
  if (!dateValue) return ""
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return String(dateValue)
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  const yyyy = date.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

function SingleReceiptCopy({ copyType, job, intake }) {
  const branch = job.branch || {}
  const shopName = branch.name || DEFAULT_SHOP_INFO.name
  const shopAddress = branch.address || DEFAULT_SHOP_INFO.address
  const shopContact = branch.contactNo || DEFAULT_SHOP_INFO.contactNo

  const customerName = job.customerNameSnapshot || job.customer?.fullName || "Walk-in"
  const customerContact = job.customerContactSnapshot || job.customer?.mobileNumber || job.customer?.email || ""
  const customerAddress = intake?.customerAddress || job.customer?.address || ""

  const technicianName = job.assignedTechnician?.fullName || job.serviceDoneBy?.fullName || ""
  const receivedByName = job.receivedBy?.fullName || job.createdBy?.fullName || ""

  // Combined unit description and accessories
  const unitText = [job.deviceDescription, job.accessoriesReceived ? `Accessories: ${job.accessoriesReceived}` : ""].filter(Boolean).join(" / ")
  const conditionText = [job.problemDescription, job.receivingRemarks ? `[Condition: ${job.receivingRemarks}]` : ""].filter(Boolean).join(" / ")

  return (
    <div className="jo-receipt-half">
      {/* Header section */}
      <div className="jo-receipt-header-grid">
        <div className="jo-receipt-logo-block">
          <h2 className="jo-receipt-brand-title">{shopName}</h2>
          <p className="jo-receipt-brand-sub">{shopAddress}</p>
          <p className="jo-receipt-brand-contact">{shopContact}</p>
        </div>

        <div className="jo-receipt-meta-block">
          <div className="jo-receipt-meta-row">
            <span className="jo-meta-label jo-bold">J.O. #</span>
            <span className="jo-meta-value jo-jo-num">{job.jobCode}</span>
          </div>
          <div className="jo-receipt-meta-row">
            <span className="jo-meta-label jo-bold">TECHNICIAN:</span>
            <span className="jo-meta-value">{technicianName}</span>
          </div>
          <div className="jo-receipt-meta-row">
            <span className="jo-meta-label">DATE:</span>
            <span className="jo-meta-value">{formatDate(job.receivedAt)}</span>
          </div>
        </div>
      </div>

      {/* Title banner */}
      <div className="jo-receipt-title-banner">
        <span>JOB ORDER/ REPAIR/S RECEIPT</span>
        <span className="jo-copy-tag">({copyType})</span>
      </div>

      {/* Notice Banner */}
      <div className="jo-receipt-notice-box">
        FOR LAPTOP ALWAYS TEST BATTERY STATUS, NO TEST NO ACCEPTANCE POLICY
      </div>

      {/* Customer & Unit Details Table */}
      <div className="jo-receipt-details-table">
        <div className="jo-detail-row">
          <div className="jo-detail-cell jo-cell-label">Received from:</div>
          <div className="jo-detail-cell jo-cell-val jo-bold">{customerName}</div>
          <div className="jo-detail-cell jo-cell-label jo-right">Contact No.:</div>
          <div className="jo-detail-cell jo-cell-val">{customerContact}</div>
        </div>
        <div className="jo-detail-row">
          <div className="jo-detail-cell jo-cell-label">Address:</div>
          <div className="jo-detail-cell jo-cell-val" style={{ gridColumn: "span 3" }}>{customerAddress}</div>
        </div>
        <div className="jo-detail-row">
          <div className="jo-detail-cell jo-cell-label">THE UNIT OF:</div>
          <div className="jo-detail-cell jo-cell-val jo-bold" style={{ gridColumn: "span 3" }}>{unitText}</div>
        </div>
        <div className="jo-detail-row">
          <div className="jo-detail-cell jo-cell-label">CONDITION:</div>
          <div className="jo-detail-cell jo-cell-val" style={{ gridColumn: "span 3" }}>{conditionText}</div>
        </div>
      </div>

      {/* Middle Row: Policy & Received By */}
      <div className="jo-receipt-policy-row">
        <div className="jo-no-claim-box">
          NO RECEIPT, NO CLAIM POLICY
        </div>
        <div className="jo-received-by-box">
          <span className="jo-received-label">Received by:</span>
          <div className="jo-staff-name-line">{receivedByName}</div>
          <span className="jo-signature-caption">Signature over Printed Name</span>
        </div>
      </div>

      {/* Terms and Conditions */}
      <div className="jo-receipt-terms-section">
        <div className="jo-terms-title jo-bold">Terms and Conditions:</div>
        <ol className="jo-terms-list">
          <li>1. The Customer is obligated to claim or retrieve the serviced item/s within seven (7) days that the service is complete.</li>
          <li>2. UNSERVICEABLE Items must be claimed within seven (7) days that customer has been informed.</li>
          <li>3. Should the item/s remained unclaimed after fifteen (15) days, the customer will be charged a storage fee of 1% of the total amount to be paid for each day that the item/s remains unclaimed.</li>
          <li>4. After thirty (30) days, Arunafeltz Computer Parts and Accessories Shop will dispose of the unclaimed Item/s.</li>
        </ol>
        <div className="jo-claim-status-row">
          <span>DATE CLAIMED: _________________</span>
          <span>STATUS: _________________</span>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="jo-receipt-disclaimer-section">
        <div className="jo-disclaimer-title jo-bold">Disclaimer:</div>
        <p className="jo-disclaimer-intro">
          By proceeding with our Desktop PC/ Laptop Checking or Cleaning services, you acknowledge and agree to the following:
        </p>
        <p className="jo-disclaimer-item">
          <strong>a. Data Loss:</strong> While we take every precaution to protect your data, we are not responsible for any data loss or corruption that may occur during the checking or cleaning process. It is strongly recommended that you back up all important files before we begin.
        </p>
        <p className="jo-disclaimer-item">
          <strong>b. Hardware Damage:</strong> We are not responsible for pre-existing hardware damage or any damage that may occur during the cleaning process due to unforeseen circumstances. We will exercise reasonable care, but hardware failure is always a possibility.
        </p>
        <p className="jo-disclaimer-item">
          <strong>c. Software Issues:</strong> We will not be held responsible for resolving any software issues or problems that are not directly related to the checking or physical cleaning of your PC.
        </p>
        <p className="jo-disclaimer-closing">
          By agreeing to our service, you understand and accept the limitations of liability outlined above. We recommend that you carefully review this disclaimer before proceeding.
        </p>

        {/* Conforme signature box */}
        <div className="jo-conforme-box">
          <span className="jo-conforme-label">Conforme:</span>
          <div className="jo-conforme-signature-line">
            <span className="jo-conforme-name">{customerName}</span>
          </div>
          <span className="jo-signature-caption">Signature Over Printed Name</span>
        </div>
      </div>
    </div>
  )
}

export default function JobOrderReceiptPrint({ job }) {
  const intake = extractIntakeRecord(job)

  return (
    <div className="jo-dual-receipt-page">
      <SingleReceiptCopy copyType="CUSTOMER COPY" intake={intake} job={job} />
      <div className="jo-sheet-cut-divider">
        <span>✄ CUT HERE</span>
      </div>
      <SingleReceiptCopy copyType="STORE COPY" intake={intake} job={job} />
    </div>
  )
}
