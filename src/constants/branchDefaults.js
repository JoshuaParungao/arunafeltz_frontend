export const BRANCH_DEFAULTS = {
  MAIN: {
    name: "Main Branch",
    address:
      "Kingspire Business Centre, Km. 71 Mac Arthur Highway, San Isidro, City of San Fernando, Pampanga, Philippines, 2000",
    contactNo: "0961-873-5798 / 045-404-0673",
  },
  MAB: {
    name: "Mabalacat Branch",
    address:
      "ODT Bldg, Mac Arthur Highway, Lakandula, Mabalacat, Pampanga, Philippines, 2010",
    contactNo: "+63 991 010 5840 / (045) 649-9669",
  },
}

export function getBranchAddress(branch) {
  if (
    branch?.address &&
    typeof branch.address === "string" &&
    branch.address.trim() &&
    branch.address !== "-" &&
    branch.address !== "—" &&
    !branch.address.toLowerCase().includes("no address")
  ) {
    return branch.address.trim()
  }
  const identifier = String(branch?.code || branch?.name || "").toUpperCase()
  if (identifier.includes("MAB")) {
    return BRANCH_DEFAULTS.MAB.address
  }
  return BRANCH_DEFAULTS.MAIN.address
}

export function getBranchContact(branch) {
  if (
    branch?.contactNo &&
    typeof branch.contactNo === "string" &&
    branch.contactNo.trim() &&
    branch.contactNo !== "-" &&
    branch.contactNo !== "—" &&
    !branch.contactNo.toLowerCase().includes("no contact")
  ) {
    return branch.contactNo.trim()
  }
  const identifier = String(branch?.code || branch?.name || "").toUpperCase()
  if (identifier.includes("MAB")) {
    return BRANCH_DEFAULTS.MAB.contactNo
  }
  return BRANCH_DEFAULTS.MAIN.contactNo
}
