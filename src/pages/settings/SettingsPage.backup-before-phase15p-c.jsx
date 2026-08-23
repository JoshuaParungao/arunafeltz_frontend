import { useEffect, useMemo, useState } from "react"
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
import { getSettings } from "../../features/settings/settings.api"
import {
  findSettingByKey,
  formatSettingValue,
  formatTermLabel,
  getFriendlySettingDescription,
  getFriendlySettingName,
  groupSettingsForDisplay,
} from "../../features/settings/settings.utils"

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

function SavedSettingCard({ setting }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-bold text-[var(--color-text-strong)]">
            {getFriendlySettingName(setting)}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            {getFriendlySettingDescription(setting)}
          </p>
        </div>

        <Badge tone={setting.isEditable ? "maroon" : "default"}>
          {setting.isEditable ? "Can be changed" : "Locked"}
        </Badge>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-[var(--color-text-strong)] whitespace-pre-wrap">
        {formatSettingValue(setting.value)}
      </div>
    </div>
  )
}

function InstallmentTermBasisPanel({ setting }) {
  const terms = setting?.value && typeof setting.value === "object" ? setting.value : {}

  return (
    <Card className="border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon-soft)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Badge tone="maroon">Current Saved Values</Badge>
          <h2 className="mt-3 text-xl font-bold text-[var(--color-text-strong)]">
            Installment / Interest Rates
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            These are the current rates used by the system. Cashier can only select a term.
            Owner/Admin controls these values.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          Viewing only
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(terms).map(([termKey, value]) => (
          <div
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4"
            key={termKey}
          >
            <p className="text-sm font-semibold text-[var(--color-muted)]">
              {formatTermLabel(termKey)}
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--color-text-strong)]">
              {value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function PlannedSettingsCard({ group }) {
  const Icon = ICONS[group.title] || Settings

  return (
    <Card
      className={
        group.priority
          ? "border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon-soft)]"
          : ""
      }
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
}

function SettingsPage() {
  const [settings, setSettings] = useState([])
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true)
      setErrorMessage("")

      try {
        const response = await getSettings()

        if (!response?.success || !Array.isArray(response?.data)) {
          throw new Error("Invalid settings response from server.")
        }

        setSettings(response.data)
      } catch (error) {
        setErrorMessage(
          error?.response?.data?.message ||
            error?.message ||
            "Unable to load saved settings.",
        )
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [])

  const installmentTermBasis = useMemo(
    () => findSettingByKey(settings, "installment.term_basis"),
    [settings],
  )

  const groupedSettings = useMemo(() => groupSettingsForDisplay(settings), [settings])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <Badge tone="maroon">Control Center</Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--color-text-strong)]">
            Settings
          </h1>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--color-muted)]">
            Manage business rules and default values used by Arunafeltz. Editing will be added
            after the save process is verified.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-muted)] shadow-card">
          {isLoading ? "Loading saved settings..." : `${settings.length} saved settings loaded`}
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-sidebar)] p-5 text-white shadow-card">
        <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <div className="min-w-0">
            <h2 className="text-xl font-bold">Business values are controlled here</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Interest rates, quotation computation, warranty duration, cash handling, receipt
              information, and branch-specific rules should come from Settings.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 text-sm leading-6 text-white/75">
            Payment method controls for GCash, card terminal, cheque, and required reference
            fields are planned for the next setup step.
          </div>
        </div>
      </section>

      {installmentTermBasis ? (
        <InstallmentTermBasisPanel setting={installmentTermBasis} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        {Object.entries(groupedSettings).map(([groupName, groupItems]) => (
          <Card key={groupName}>
            <p className="text-sm font-semibold text-[var(--color-muted)]">{groupName}</p>
            <p className="mt-2 text-3xl font-bold text-[var(--color-text-strong)]">
              {groupItems.length}
            </p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_480px]">
        <Card>
          <h2 className="text-lg font-bold text-[var(--color-text-strong)]">
            Current Saved Business Settings
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            These values are currently used by the system.
          </p>

          <div className="mt-5 space-y-5">
            {Object.entries(groupedSettings).map(([groupName, groupItems]) => (
              <div key={groupName}>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  {groupName}
                </h3>

                <div className="space-y-3">
                  {groupItems.map((setting) => (
                    <SavedSettingCard key={setting.id} setting={setting} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-bold text-[var(--color-text-strong)]">
              Planned Settings Sections
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
              These are the business-friendly sections that will become editable step by step.
            </p>
          </Card>

          {SETTINGS_GROUPS.map((group) => (
            <PlannedSettingsCard group={group} key={group.title} />
          ))}
        </div>
      </section>
    </div>
  )
}

export default SettingsPage
