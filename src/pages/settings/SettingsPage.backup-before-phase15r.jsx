import { useEffect, useMemo, useState } from "react"
import {
  Banknote,
  Building2,
  ChevronDown,
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
  formatTermLabel,
  getFriendlySettingDescription,
  getFriendlySettingName,
  getFriendlySettingValue,
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

function ExpandableCard({
  title,
  description,
  icon: Icon = Settings,
  badge,
  isOpen,
  onToggle,
  children,
}) {
  return (
    <Card className={isOpen ? "border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon-soft)]" : ""}>
      <button
        aria-expanded={isOpen}
        className="flex w-full items-start justify-between gap-4 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="flex min-w-0 items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-maroon-soft)] text-[var(--color-maroon)]">
            <Icon className="size-5" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-[var(--color-text-strong)]">{title}</p>
              {badge ? <Badge tone="maroon">{badge}</Badge> : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              {description}
            </p>
          </div>
        </div>

        <ChevronDown
          className={`mt-2 size-5 shrink-0 text-[var(--color-muted)] transition ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen ? <div className="mt-5">{children}</div> : null}
    </Card>
  )
}

function SavedSettingItem({ setting }) {
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

      <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-[var(--color-text-strong)]">
        {getFriendlySettingValue(setting)}
      </div>
    </div>
  )
}

function InstallmentRatesPanel({ setting }) {
  const terms = setting?.value && typeof setting.value === "object" ? setting.value : {}

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
  )
}

function PlannedSettingsContent({ group }) {
  return (
    <div className="space-y-2">
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
  )
}

function SettingsPage() {
  const [settings, setSettings] = useState([])
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [openSavedGroup, setOpenSavedGroup] = useState("Business Computation Settings")
  const [openPlannedGroup, setOpenPlannedGroup] = useState("Installment / Interest Rates")

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
            Business values are organized into expandable cards. Click a card to view its details.
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
        <ExpandableCard
          badge="Current Saved Values"
          description="Current rates used when computing installment or credit terms."
          icon={Percent}
          isOpen={openSavedGroup === "Installment Rates"}
          onToggle={() =>
            setOpenSavedGroup((current) =>
              current === "Installment Rates" ? "" : "Installment Rates",
            )
          }
          title="Installment / Interest Rates"
        >
          <InstallmentRatesPanel setting={installmentTermBasis} />
        </ExpandableCard>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_480px]">
        <Card>
          <h2 className="text-lg font-bold text-[var(--color-text-strong)]">
            Current Saved Business Settings
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Click a group to view the saved values currently used by the system.
          </p>

          <div className="mt-5 space-y-3">
            {Object.entries(groupedSettings).map(([groupName, groupItems]) => (
              <ExpandableCard
                badge={`${groupItems.length} saved`}
                description="Saved values currently used by the system."
                icon={Settings}
                isOpen={openSavedGroup === groupName}
                key={groupName}
                onToggle={() =>
                  setOpenSavedGroup((current) => (current === groupName ? "" : groupName))
                }
                title={groupName}
              >
                <div className="space-y-3">
                  {groupItems.map((setting) => (
                    <SavedSettingItem key={setting.id} setting={setting} />
                  ))}
                </div>
              </ExpandableCard>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-bold text-[var(--color-text-strong)]">
              Settings Sections
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
              Click a section to view what will be managed there.
            </p>
          </Card>

          {SETTINGS_GROUPS.map((group) => {
            const Icon = ICONS[group.title] || Settings

            return (
              <ExpandableCard
                badge={group.priority ? "Priority" : null}
                description={group.description}
                icon={Icon}
                isOpen={openPlannedGroup === group.title}
                key={group.title}
                onToggle={() =>
                  setOpenPlannedGroup((current) =>
                    current === group.title ? "" : group.title,
                  )
                }
                title={group.title}
              >
                <PlannedSettingsContent group={group} />
              </ExpandableCard>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default SettingsPage
