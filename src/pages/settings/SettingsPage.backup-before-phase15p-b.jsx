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
  getSettingsByCategory,
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

function SettingRecordCard({ setting }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-bold text-[var(--color-text-strong)]">{setting.label}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">{setting.key}</p>
        </div>

        <Badge tone={setting.isEditable ? "maroon" : "default"}>
          {setting.isEditable ? "Editable" : "Locked"}
        </Badge>
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        {setting.description || "No description set."}
      </p>

      <pre className="mt-3 max-h-56 overflow-auto rounded-2xl bg-white p-3 text-xs leading-5 text-[var(--color-text-strong)]">
        {formatSettingValue(setting.value)}
      </pre>
    </div>
  )
}

function InstallmentTermBasisPanel({ setting }) {
  const terms = setting?.value && typeof setting.value === "object" ? setting.value : {}

  return (
    <Card className="border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon-soft)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <Badge tone="maroon">Backend Loaded</Badge>
          <h2 className="mt-3 text-xl font-bold text-[var(--color-text-strong)]">
            Installment / Interest Rates
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            These values are loaded from <span className="font-bold">installment.term_basis</span>.
            Cashier should only select a term; Owner/Admin controls these values.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          Read-only for now
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
            "Unable to load settings from backend.",
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

  const businessRules = useMemo(
    () => getSettingsByCategory(settings, "BUSINESS_RULE"),
    [settings],
  )

  const operationRules = useMemo(
    () => getSettingsByCategory(settings, "OPERATION"),
    [settings],
  )

  const documentRules = useMemo(
    () => getSettingsByCategory(settings, "DOCUMENT"),
    [settings],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <Badge tone="maroon">Core Control Center</Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--color-text-strong)]">
            Settings
          </h1>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--color-muted)]">
            Current settings are loaded from backend. Editing and saving will be added only after
            the update route is inspected and verified.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-muted)] shadow-card">
          {isLoading ? "Loading settings..." : `${settings.length} backend settings loaded`}
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
            <h2 className="text-xl font-bold">Settings rule locked</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              No permanent hardcoded business values. Interest, term basis, quotation formulas,
              warranty durations, cash box rules, receipt text, and branch-specific setting rules
              must come from backend Settings.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 text-sm leading-6 text-white/75">
            Payment method settings such as GCash, card terminal, cheque, and required reference
            fields are planned, but they are not yet present in the current backend settings list.
          </div>
        </div>
      </section>

      {installmentTermBasis ? (
        <InstallmentTermBasisPanel setting={installmentTermBasis} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <p className="text-sm font-semibold text-[var(--color-muted)]">Business Rules</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-text-strong)]">
            {businessRules.length}
          </p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-[var(--color-muted)]">Operation Rules</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-text-strong)]">
            {operationRules.length}
          </p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-[var(--color-muted)]">Document Rules</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-text-strong)]">
            {documentRules.length}
          </p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-[var(--color-text-strong)]">
            Backend settings records
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Read-only list from GET /api/settings.
          </p>

          <div className="mt-5 space-y-3">
            {settings.map((setting) => (
              <SettingRecordCard key={setting.id} setting={setting} />
            ))}
          </div>
        </Card>

        <div className="space-y-4">
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
        </div>
      </section>
    </div>
  )
}

export default SettingsPage
