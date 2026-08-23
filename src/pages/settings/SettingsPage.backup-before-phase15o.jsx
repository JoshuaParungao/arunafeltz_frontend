import { SETTINGS_SECTIONS } from "../../constants/settings"
import Card from "../../components/ui/Card"
import Badge from "../../components/ui/Badge"

function SettingsPage() {
  return (
    <div className="space-y-5">
      <div>
        <Badge tone="maroon">Core Control Center</Badge>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--color-text-strong)]">
          Settings
        </h1>
        <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
          All changeable business values must be controlled here, including interest percentage,
          installment rates, payment fields, price tiers, discounts, inventory rules, warranty
          rules, service rules, cash rules, incentives, and document numbering.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_SECTIONS.map((section) => (
          <Card key={section}>
            <p className="font-bold text-[var(--color-text-strong)]">{section}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              Placeholder section. Editable form and backend connection will be added in the
              Settings phase.
            </p>
          </Card>
        ))}
      </section>
    </div>
  )
}

export default SettingsPage
