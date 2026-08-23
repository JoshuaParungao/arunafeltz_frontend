export const USER_ROLES = {
  SUPER_OWNER: "SUPER_OWNER",
  BRANCH_OWNER: "BRANCH_OWNER",
  ADMIN: "ADMIN",
  CASHIER: "CASHIER",
  TECHNICIAN: "TECHNICIAN",
  CASH_CUSTODIAN: "CASH_CUSTODIAN",
}

export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  PENDING: "PENDING",
  DISABLED: "DISABLED",
  REJECTED: "REJECTED",
}

export const ROLE_LABELS = {
  SUPER_OWNER: "Main Admin",
  BRANCH_OWNER: "Legacy Branch Owner",
  ADMIN: "Admin",
  CASHIER: "Sales Agent",
  TECHNICIAN: "Technician",
  CASH_CUSTODIAN: "Legacy Cash Custodian",
}

export const ACCOUNT_TYPES = {
  MAIN_ADMIN: "MAIN_ADMIN",
  ADMIN: "ADMIN",
  SENIOR_SALES_AGENT: "SENIOR_SALES_AGENT",
  SALES_AGENT: "SALES_AGENT",
  SENIOR_TECHNICIAN: "SENIOR_TECHNICIAN",
  TECHNICIAN: "TECHNICIAN",
}

export const ACCOUNT_TYPE_CONFIG = {
  [ACCOUNT_TYPES.MAIN_ADMIN]: {
    label: "Main Admin",
    role: USER_ROLES.SUPER_OWNER,
    incentiveClassification: "NONE",
  },

  [ACCOUNT_TYPES.ADMIN]: {
    label: "Admin",
    role: USER_ROLES.ADMIN,
    incentiveClassification: "NONE",
  },

  [ACCOUNT_TYPES.SENIOR_SALES_AGENT]: {
    label: "Senior Sales Agent",
    role: USER_ROLES.CASHIER,
    incentiveClassification: "SENIOR_SALES_AGENT",
  },

  [ACCOUNT_TYPES.SALES_AGENT]: {
    label: "Sales Agent",
    role: USER_ROLES.CASHIER,
    incentiveClassification: "SALES_AGENT",
  },

  [ACCOUNT_TYPES.SENIOR_TECHNICIAN]: {
    label: "Senior Technician",
    role: USER_ROLES.TECHNICIAN,
    incentiveClassification: "SENIOR_TECHNICIAN",
  },

  [ACCOUNT_TYPES.TECHNICIAN]: {
    label: "Technician",
    role: USER_ROLES.TECHNICIAN,
    incentiveClassification: "TECHNICIAN",
  },
}

export function resolveAccountType(role, incentiveClassification = "NONE") {
  if (role === USER_ROLES.SUPER_OWNER) {
    return ACCOUNT_TYPES.MAIN_ADMIN
  }

  if (role === USER_ROLES.ADMIN) {
    return ACCOUNT_TYPES.ADMIN
  }

  if (role === USER_ROLES.CASHIER) {
    return incentiveClassification === "SENIOR_SALES_AGENT"
      ? ACCOUNT_TYPES.SENIOR_SALES_AGENT
      : ACCOUNT_TYPES.SALES_AGENT
  }

  if (role === USER_ROLES.TECHNICIAN) {
    return incentiveClassification === "SENIOR_TECHNICIAN"
      ? ACCOUNT_TYPES.SENIOR_TECHNICIAN
      : ACCOUNT_TYPES.TECHNICIAN
  }

  return null
}

export function getAccountTypeLabel(role, incentiveClassification = "NONE") {
  const accountType = resolveAccountType(role, incentiveClassification)

  if (accountType) {
    return ACCOUNT_TYPE_CONFIG[accountType]?.label || accountType
  }

  return ROLE_LABELS[role] || String(role || "Role").replaceAll("_", " ")
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || String(role || "Role").replaceAll("_", " ")
}
