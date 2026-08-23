import {
  Banknote,
  ClipboardList,
  PackageSearch,
  Percent,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wrench,
} from "lucide-react"

import Badge from "../../components/ui/Badge"
import Card from "../../components/ui/Card"
import { canRoleAccessModule } from "../../constants/appModules"

const quickActions = [
  {
    title: "Cash Box",
    description: "Review cash transactions and assigned handovers.",
    pageKey: "cash-box",
    icon: Banknote,
  },
  {
    title: "My Incentives",
    description: "Review incentives credited to your completed sales or service work.",
    pageKey: "incentives",
    icon: Percent,
  },
  {
    title: "Open POS",
    description: "Start a sale or prepare a customer transaction.",
    pageKey: "pos",
    icon: ShoppingCart,
  },
  {
    title: "New Quotation",
    description: "Create or continue a customer quotation.",
    pageKey: "quotations",
    icon: ClipboardList,
  },
  {
    title: "Inventory Lookup",
    description: "Search item stock, branch availability, and item details.",
    pageKey: "inventory",
    icon: PackageSearch,
  },
  {
    title: "Customer Lookup",
    description: "Find customer records and transaction history.",
    pageKey: "customers",
    icon: Users,
  },
  {
    title: "Service Jobs",
    description: "View and update assigned service workflow.",
    pageKey: "services",
    icon: Wrench,
  },
  {
    title: "Warranty Claims",
    description: "Check warranty status, serials, and claim progress.",
    pageKey: "warranty",
    icon: ShieldCheck,
  },
]

const reminderItems = [
  "Staff can operate sales, quotations, inventory lookup, customers, services, warranty, and serial monitoring.",
  "Staff can view only their own incentives; cost, profit, reports, audit logs, settings, and user management remain hidden.",
  "Account permissions and the selected branch determine which records staff can access.",
]

function StaffDashboardPage({ user, selectedBranch, onNavigate }) {
  const availableActions = quickActions.filter((action) =>
    canRoleAccessModule(user?.role, action.pageKey),
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <Badge tone="maroon">Staff Operations</Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--color-text-strong)]">
            Staff Dashboard
          </h1>
          <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
            Welcome, {user?.fullName || user?.username || "Staff"}. Current branch:{" "}
            <span className="font-bold text-[var(--color-text-strong)]">
              {selectedBranch?.code || user?.branch?.code || "N/A"}
            </span>
          </p>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {availableActions.map((action) => {
          const Icon = action.icon

          return (
            <button
              className="min-w-0 text-left"
              key={action.pageKey}
              onClick={() => onNavigate(action.pageKey)}
              type="button"
            >
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-[var(--color-maroon)]">
                <div className="flex items-start gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon-soft)] text-[var(--color-maroon)]">
                    <Icon className="size-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="font-bold text-[var(--color-text-strong)]">
                      {action.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                      {action.description}
                    </p>
                  </div>
                </div>
              </Card>
            </button>
          )
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Card>
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon-soft)] text-[var(--color-maroon)]">
              <ScanLine className="size-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[var(--color-text-strong)]">
                Serial and item lookup
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                Use Inventory Lookup, Serial Monitoring, Customers, Quotations, Sales,
                and Warranty Claims to search the records available to your role.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-[var(--color-text-strong)]">
            Staff access reminder
          </h2>

          <div className="mt-4 space-y-3">
            {reminderItems.map((item) => (
              <p className="text-sm leading-6 text-[var(--color-muted)]" key={item}>
                {item}
              </p>
            ))}
          </div>
        </Card>
      </section>
    </div>
  )
}

export default StaffDashboardPage
