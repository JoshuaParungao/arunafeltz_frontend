import {
  Banknote,
  Building2,
  FileText,
  Landmark,
  Percent,
  ReceiptText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react"

import Badge from "../../components/ui/Badge"
import Card from "../../components/ui/Card"
import { SETTINGS_GROUPS } from "../../constants/settingsGroups"

const ICONS = {
  "Business Profile": Building2,
  "Branch Settings": Landmark,
  "Payment Methods": Banknote,
  "Installment / Interest Rates": Percent,
  "Price Tier Settings": ReceiptText,
  "Discount Rules": SlidersHorizontal,
  "Inventory Rules": Settings,
  "Warranty Rules": ShieldCheck,
  "Service Rules": Settings,
  "Cash Box Rules": Banknote,
  "Incentive Rules": Percent,
  "Document Numbering": FileText,
  "System Preferences": SlidersHorizontal,
}

function SettingsPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <Badge tone="maroon">Core Control Center</Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--color-text-strong)]">
            Settings
          </h1>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--color-muted)]">
            All changeable business values must be controlled here. Defaults are only starter
            values; Owner/Admin can update allowed settings anytime.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-muted)] shadow-card">
          API forms will be connected in the Settings integration phase.
        </div>
      </div>

      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-sidebar)] p-5 text-white shadow-card">
        <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <div className="min-w-0">
            <h2 className="text-xl font-bold">Settings rule locked</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Cashier and technician should not manually edit business rates. The system must get
              payment rules, installment interest/percentage, price tiers, discount limits,
              warranty rules, service rules, cash rules, incentives, and document numbering from
              Settings.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 text-sm leading-6 text-white/75">
            No permanent hardcoded interest. No permanent hardcoded payment fields. No staff
            editing of owner-controlled values.
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_GROUPS.map((group) => {
          const Icon = ICONS[group.title] || Settings

          return (
            <Card
              className={
                group.priority
                  ? "border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon-soft)]"
                  : ""
              }
              key={group.title}
            >
              <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon-soft)] text-[var(--color-maroon)]">
                  <Icon className="size-5" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-[var(--color-text-strong)]">{group.title}</p>
                    {group.priority ? <Badge tone="maroon">Priority</Badge> : null}
                  </div>

                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                    {group.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {group.items.map((item) => (
                  <div
                    className="flex items-start gap-2 rounded-2xl bg-[var(--color-soft)] px-3 py-2 text-sm text-[var(--color-text)]"
                    key={item}
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--color-maroon)]" />
                    <span className="min-w-0">{item}</span>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </section>
    </div>
  )
}

export default SettingsPage
