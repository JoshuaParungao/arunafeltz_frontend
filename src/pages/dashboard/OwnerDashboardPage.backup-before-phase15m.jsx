import Card from "../../components/ui/Card"
import Badge from "../../components/ui/Badge"

const cards = [
  { title: "Sales Today", value: "For API", note: "Sales summary endpoint later" },
  { title: "Cash Box", value: "For API", note: "Cash, GCash, bank, card, cheque separation" },
  { title: "Low Stock", value: "For API", note: "Inventory alert summary" },
  { title: "Pending Transfers", value: "For API", note: "Branch movement monitoring" },
  { title: "Warranty Alerts", value: "For API", note: "Claims that need action" },
  { title: "Service Jobs", value: "For API", note: "Open technician workflow" },
]

function OwnerDashboardPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge tone="maroon">Owner/Admin Monitoring</Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--color-text-strong)]">
            Arunafeltz Business Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Real data will connect after auth and API client setup.
          </p>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <p className="truncate text-sm font-semibold text-[var(--color-muted)]">{card.title}</p>
            <p className="mt-2 truncate text-2xl font-bold text-[var(--color-text-strong)]">
              {card.value}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{card.note}</p>
          </Card>
        ))}
      </section>
    </div>
  )
}

export default OwnerDashboardPage
