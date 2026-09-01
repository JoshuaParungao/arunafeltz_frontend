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

  // --- OPERATIONS & SALES ---
  {
    key: "pos",
    label: "POS Cashiering",
    group: "Operations",
    roles: SALES_OPERATION_ROLES,
  },
  {
    key: "quotations",
    label: "Quotations",
    group: "Operations",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "services",
    label: "Services / Job Orders",
    group: "Operations",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "warranty",
    label: "Warranty Claims",
    group: "Operations",
    roles: BRANCH_OPERATION_ROLES,
  },

  // --- INVENTORY & PURCHASING ---
  {
    key: "inventory",
    label: "Branch Inventory",
    group: "Inventory & Purchasing",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "serials",
    label: "Serial Monitoring",
    group: "Inventory & Purchasing",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "stock-transfers",
    label: "Stock Transfers",
    group: "Inventory & Purchasing",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "purchase-orders",
    label: "Purchase Orders",
    group: "Inventory & Purchasing",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "receivings",
    label: "Receiving / Deliveries",
    group: "Inventory & Purchasing",
    roles: BRANCH_OPERATION_ROLES,
  },

  // --- FINANCE & CREDITS ---
  {
    key: "cash-box",
    label: "Cash Register & Vault",
    group: "Finance & Credits",
    roles: [USER_ROLES.SUPER_OWNER, USER_ROLES.ADMIN],
  },
  {
    key: "credits",
    label: "Credits & Installments",
    group: "Finance & Credits",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "incentives",
    label: "Staff Incentives",
    group: "Finance & Credits",
    roles: [...OWNER_ADMIN_ROLES, ...STAFF_OPERATION_ROLES],
  },

  // --- FILE MAINTENANCE (MASTER DATA) ---
  {
    key: "items",
    label: "Products & Pricing (Items)",
    group: "File Maintenance",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "customers",
    label: "Customer Directory",
    group: "File Maintenance",
    roles: BRANCH_OPERATION_ROLES,
  },
  {
    key: "suppliers",
    label: "Supplier Directory",
    group: "File Maintenance",
    roles: OWNER_ADMIN_ROLES,
  },
  {
    key: "users",
    label: "Users & Staff Accounts",
    group: "File Maintenance",
    roles: OWNER_ADMIN_ROLES,
  },
  {
    key: "settings",
    label: "System Rules & Settings",
    group: "File Maintenance",
    roles: OWNER_ADMIN_ROLES,
  },

  // --- REPORTS & AUDIT ---
  {
    key: "reports",
    label: "Reports & Analytics",
    group: "Reports & Audit",
    roles: OWNER_ADMIN_ROLES,
  },
  {
    key: "alerts",
    label: "Action Alerts",
    group: "Reports & Audit",
    roles: OWNER_ADMIN_ROLES,
  },
  {
    key: "audit-logs",
    label: "Activity Audit Logs",
    group: "Reports & Audit",
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
