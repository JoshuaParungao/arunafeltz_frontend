import { USER_ROLES } from "./roles"

const OWNER_ADMIN_ROLES = [
  USER_ROLES.SUPER_OWNER,
  USER_ROLES.BRANCH_OWNER,
  USER_ROLES.ADMIN,
]

const STAFF_OPERATION_ROLES = [
  USER_ROLES.CASHIER,
  USER_ROLES.TECHNICIAN,
  USER_ROLES.CASH_CUSTODIAN,
]

const BRANCH_OPERATION_ROLES = [
  ...OWNER_ADMIN_ROLES,
  USER_ROLES.CASHIER,
  USER_ROLES.TECHNICIAN,
]

const SALES_OPERATION_ROLES = [
  ...OWNER_ADMIN_ROLES,
  USER_ROLES.CASHIER,
  USER_ROLES.TECHNICIAN,
]

export const APP_MODULES = [
  {
    key: "staff-dashboard",
    label: "Staff Dashboard",
    group: "Dashboard",
    roles: STAFF_OPERATION_ROLES,
  },

  {
    key: "pos",
    label: "POS / Sales",
    group: "Core Operations",
    roles: SALES_OPERATION_ROLES,
  },
  {
    key: "quotations",
    label: "Quotations",
    group: "Core Operations",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "inventory",
    label: "Inventory",
    group: "Core Operations",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "items",
    label: "Items / Catalog",
    group: "Core Operations",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "customers",
    label: "Customers",
    group: "Core Operations",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "services",
    label: "Services / Job Orders",
    group: "Core Operations",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "warranty",
    label: "Warranty Claims",
    group: "Core Operations",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "serials",
    label: "Serial Monitoring",
    group: "Core Operations",
    roles: BRANCH_OPERATION_ROLES,
  },

  {
    key: "suppliers",
    label: "Suppliers",
    group: "Supply / Stock",
    roles: OWNER_ADMIN_ROLES,
  },
  {
    key: "purchase-orders",
    label: "Purchase Orders",
    group: "Supply / Stock",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "receivings",
    label: "Receiving / Deliveries",
    group: "Supply / Stock",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "stock-transfers",
    label: "Stock Transfers",
    group: "Supply / Stock",
    roles: BRANCH_OPERATION_ROLES,
  },

  {
    key: "cash-box",
    label: "Cash Box",
    group: "Finance",
    roles: [USER_ROLES.SUPER_OWNER, USER_ROLES.ADMIN],
  },
  {
    key: "credits",
    label: "Credits / Installments",
    group: "Finance",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "incentives",
    label: "Incentives",
    group: "Finance",
    roles: [...OWNER_ADMIN_ROLES, ...STAFF_OPERATION_ROLES],
  },

  {
    key: "reports",
    label: "Reports",
    group: "Monitoring",
    roles: OWNER_ADMIN_ROLES,
  },
  {
    key: "alerts",
    label: "Alerts",
    group: "Monitoring",
    roles: OWNER_ADMIN_ROLES,
  },
  {
    key: "audit-logs",
    label: "Audit Logs",
    group: "Monitoring",
    roles: OWNER_ADMIN_ROLES,
  },

  {
    key: "settings",
    label: "Settings",
    group: "Management",
    roles: OWNER_ADMIN_ROLES,
  },
  {
    key: "users",
    label: "Users / Account Types",
    group: "Management",
    roles: OWNER_ADMIN_ROLES,
  },
]

export function getModulesForRole(role) {
  return APP_MODULES.filter((module) => module.roles.includes(role))
}

export function canRoleAccessModule(role, moduleKey) {
  return APP_MODULES.some(
    (module) => module.key === moduleKey && module.roles.includes(role),
  )
}

export function getDefaultModuleForRole(role) {
  if (OWNER_ADMIN_ROLES.includes(role)) return "pos"
  return "staff-dashboard"
}
