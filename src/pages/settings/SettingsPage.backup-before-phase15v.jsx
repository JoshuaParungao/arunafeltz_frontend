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
import { getSettings, updateSettingByScopeKey } from "../../features/settings/settings.api"
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

const INSTALLMENT_TERMS = [
  { key: "STRAIGHT", label: "Straight" },
  { key: "MONTH_3", label: "3 months" },
  { key: "MONTH_6", label: "6 months" },
  { key: "MONTH_9", label: "9 months" },
  { key: "MONTH_12", label: "12 months" },
  { key: "MONTH_18", label: "18 months" },
  { key: "MONTH_24", label: "24 months" },
]

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

function ReceiptBusinessNameForm({ setting, onSaved, canManageSettings = false }) {
  const [value, setValue] = useState(setting?.value || "")
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setValue(setting?.value || "")
  }, [setting])

  const handleSave = async (event) => {
    event.preventDefault()
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner can change this setting.")
      return
    }

    const trimmedValue = value.trim()

    if (!trimmedValue) {
      setErrorMessage("Business name is required.")
      return
    }

    if (trimmedValue === setting?.value) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const response = await updateSettingByScopeKey(setting.scopeKey, {
        value: trimmedValue,
      })

      if (!response?.success || !response?.data) {
        throw new Error("Unable to save business name.")
      }

      onSaved(response.data)
      setMessage("Business name saved successfully.")
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Unable to save business name.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (!setting) return null

  return (
    <Card className="border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon-soft)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Badge tone="maroon">{canManageSettings ? "Editable" : "Viewing only"}</Badge>
          <h2 className="mt-3 text-xl font-bold text-[var(--color-text-strong)]">
            Receipt Business Name
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            This is the business name shown on receipts and printable documents.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          {canManageSettings ? "Save carefully" : "Viewing only"}
        </div>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSave}>
        <label className="block">
          <span className="text-sm font-bold text-[var(--color-text-strong)]">
            Business name
          </span>
          <input
            className="mt-2 h-12 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm outline-none transition focus:border-[var(--color-maroon)] disabled:bg-[var(--color-soft)]"
            disabled={!canManageSettings || isSaving}
            onChange={(event) => setValue(event.target.value)}
            type="text"
            value={value}
          />
        </label>

        {!canManageSettings ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
            Only Super Owner can change this setting. You can still view the current value.
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className="h-12 rounded-2xl bg-[var(--color-maroon)] px-5 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canManageSettings || isSaving}
            type="submit"
          >
            {!canManageSettings ? "View Only" : isSaving ? "Saving..." : "Save Business Name"}
          </button>

          <button
            className="h-12 rounded-2xl border border-[var(--color-border)] bg-white px-5 text-sm font-bold text-[var(--color-text-strong)] shadow-card transition hover:bg-[var(--color-soft)]"
            disabled={isSaving}
            onClick={() => {
              setValue(setting.value || "")
              setMessage("")
              setErrorMessage("")
            }}
            type="button"
          >
            Reset
          </button>
        </div>
      </form>
    </Card>
  )
}

function InstallmentRatesForm({ setting, onSaved, canManageSettings = false }) {
  const [values, setValues] = useState({})
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const currentValue = setting?.value && typeof setting.value === "object" ? setting.value : {}
    setValues(currentValue)
  }, [setting])

  if (!setting) return null

  const handleChange = (termKey, inputValue) => {
    setValues((currentValues) => ({
      ...currentValues,
      [termKey]: inputValue,
    }))
  }

  const handleReset = () => {
    const currentValue = setting?.value && typeof setting.value === "object" ? setting.value : {}
    setValues(currentValue)
    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner can change installment rates.")
      return
    }

    const nextValue = {}

    for (const term of INSTALLMENT_TERMS) {
      const rawValue = values[term.key]
      const numericValue = Number(rawValue)

      if (rawValue === "" || rawValue === null || rawValue === undefined) {
        setErrorMessage(`${term.label} rate is required.`)
        return
      }

      if (Number.isNaN(numericValue) || numericValue <= 0) {
        setErrorMessage(`${term.label} rate must be greater than 0.`)
        return
      }

      nextValue[term.key] = numericValue
    }

    const oldValue = JSON.stringify(setting.value)
    const newValue = JSON.stringify(nextValue)

    if (oldValue === newValue) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const response = await updateSettingByScopeKey(setting.scopeKey, {
        value: nextValue,
      })

      if (!response?.success || !response?.data) {
        throw new Error("Unable to save installment rates.")
      }

      onSaved(response.data)
      setMessage("Installment rates saved successfully.")
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Unable to save installment rates.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon-soft)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Badge tone="maroon">{canManageSettings ? "Editable" : "Viewing only"}</Badge>
          <h2 className="mt-3 text-xl font-bold text-[var(--color-text-strong)]">
            Installment / Interest Rates
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            These rates are used for installment or credit computations. Staff can only select a term.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          {canManageSettings ? "Save carefully" : "Viewing only"}
        </div>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSave}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {INSTALLMENT_TERMS.map((term) => (
            <label
              className="block rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4"
              key={term.key}
            >
              <span className="text-sm font-bold text-[var(--color-text-strong)]">
                {term.label}
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm font-bold outline-none transition focus:border-[var(--color-maroon)] disabled:bg-[var(--color-soft)]"
                disabled={!canManageSettings || isSaving}
                inputMode="decimal"
                min="0.0001"
                onChange={(event) => handleChange(term.key, event.target.value)}
                step="any"
                type="number"
                value={values[term.key] ?? ""}
              />
            </label>
          ))}
        </div>

        {!canManageSettings ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
            Only Super Owner can change installment rates. You can still view the current values.
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className="h-12 rounded-2xl bg-[var(--color-maroon)] px-5 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canManageSettings || isSaving}
            type="submit"
          >
            {!canManageSettings ? "View Only" : isSaving ? "Saving..." : "Save Installment Rates"}
          </button>

          <button
            className="h-12 rounded-2xl border border-[var(--color-border)] bg-white px-5 text-sm font-bold text-[var(--color-text-strong)] shadow-card transition hover:bg-[var(--color-soft)]"
            disabled={isSaving}
            onClick={handleReset}
            type="button"
          >
            Reset
          </button>
        </div>
      </form>
    </Card>
  )
}

function PaymentMethodsSetupCard({ canManageSettings = false }) {
  const [paymentMethods, setPaymentMethods] = useState({
    cash: true,
    gcash: true,
    bankTransfer: true,
    cardTerminal: true,
    cheque: true,
    creditInstallment: true,
    mixedPayment: true,
    requireReferenceNumber: true,
    requireCardApprovalCode: true,
    requireChequeNumber: true,
    requireBankName: true,
    requireRemarks: false,
  })

  const paymentOptions = [
    { key: "cash", label: "Cash", description: "Accept physical cash payments." },
    { key: "gcash", label: "GCash", description: "Accept wallet payments with reference number." },
    { key: "bankTransfer", label: "Bank Transfer", description: "Accept bank payments with bank name and reference number." },
    { key: "cardTerminal", label: "Card / Payment Terminal", description: "Accept card terminal payments with approval code." },
    { key: "cheque", label: "Cheque", description: "Accept cheque payments with cheque number and bank name." },
    { key: "creditInstallment", label: "Credit / Installment", description: "Allow customer credit or installment terms." },
    { key: "mixedPayment", label: "Mixed Payment", description: "Allow more than one payment type in one transaction." },
  ]

  const requiredFields = [
    { key: "requireReferenceNumber", label: "Reference number required" },
    { key: "requireCardApprovalCode", label: "Card approval code required" },
    { key: "requireChequeNumber", label: "Cheque number required" },
    { key: "requireBankName", label: "Bank name required" },
    { key: "requireRemarks", label: "Remarks required" },
  ]

  const handleToggle = (key) => {
    if (!canManageSettings) return

    setPaymentMethods((currentValue) => ({
      ...currentValue,
      [key]: !currentValue[key],
    }))
  }

  return (
    <Card className="border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon-soft)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Badge tone="maroon">{canManageSettings ? "Setup Draft" : "Viewing only"}</Badge>
          <h2 className="mt-3 text-xl font-bold text-[var(--color-text-strong)]">
            Payment Methods
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            This prepares the payment method rules for POS and collections. Saving will be enabled
            after payment method settings are added to the backend.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          Setup only for now
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div>
          <h3 className="font-bold text-[var(--color-text-strong)]">Accepted payment types</h3>
          <div className="mt-3 space-y-3">
            {paymentOptions.map((option) => (
              <button
                className="flex w-full items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-left disabled:cursor-not-allowed disabled:opacity-80"
                disabled={!canManageSettings}
                key={option.key}
                onClick={() => handleToggle(option.key)}
                type="button"
              >
                <span
                  className={`mt-1 grid size-5 shrink-0 place-items-center rounded-md border ${
                    paymentMethods[option.key]
                      ? "border-[var(--color-maroon)] bg-[var(--color-maroon)]"
                      : "border-[var(--color-border)] bg-white"
                  }`}
                >
                  {paymentMethods[option.key] ? (
                    <span className="size-2 rounded-full bg-white" />
                  ) : null}
                </span>

                <span className="min-w-0">
                  <span className="block font-bold text-[var(--color-text-strong)]">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--color-muted)]">
                    {option.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-bold text-[var(--color-text-strong)]">Required payment details</h3>
          <div className="mt-3 space-y-3">
            {requiredFields.map((field) => (
              <button
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-left disabled:cursor-not-allowed disabled:opacity-80"
                disabled={!canManageSettings}
                key={field.key}
                onClick={() => handleToggle(field.key)}
                type="button"
              >
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-md border ${
                    paymentMethods[field.key]
                      ? "border-[var(--color-maroon)] bg-[var(--color-maroon)]"
                      : "border-[var(--color-border)] bg-white"
                  }`}
                >
                  {paymentMethods[field.key] ? (
                    <span className="size-2 rounded-full bg-white" />
                  ) : null}
                </span>

                <span className="font-bold text-[var(--color-text-strong)]">
                  {field.label}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--color-muted)]">
            These controls are prepared for the POS payment screen. They are not saved yet because
            payment method settings are not available in the current backend settings list.
          </div>
        </div>
      </div>
    </Card>
  )
}

function SettingsPage({ user }) {
  const [settings, setSettings] = useState([])
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [openSavedGroup, setOpenSavedGroup] = useState("Business Computation Settings")
  const [openPlannedGroup, setOpenPlannedGroup] = useState("Installment / Interest Rates")

  const canManageSettings = user?.role === "SUPER_OWNER"

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true)
      setErrorMessage("")

      try {
        const response = await getSettings()

        if (!response?.success || !Array.isArray(response?.data)) {
          throw new Error("Unable to load saved settings.")
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

  const receiptBusinessName = useMemo(
    () => findSettingByKey(settings, "receipt.business_name"),
    [settings],
  )

  const groupedSettings = useMemo(() => groupSettingsForDisplay(settings), [settings])

  const handleSettingSaved = (updatedSetting) => {
    setSettings((currentSettings) =>
      currentSettings.map((setting) =>
        setting.id === updatedSetting.id ? updatedSetting : setting,
      ),
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <Badge tone="maroon">Control Center</Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--color-text-strong)]">
            Settings
          </h1>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--color-muted)]">
            Business values are organized into editable and expandable cards.
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
            {canManageSettings
              ? "You can update available settings. Save carefully."
              : "You can view settings. Only Super Owner can change them."}
          </div>
        </div>
      </section>

      <PaymentMethodsSetupCard canManageSettings={canManageSettings} />

      <ReceiptBusinessNameForm
        canManageSettings={canManageSettings}
        onSaved={handleSettingSaved}
        setting={receiptBusinessName}
      />

      <InstallmentRatesForm
        canManageSettings={canManageSettings}
        onSaved={handleSettingSaved}
        setting={installmentTermBasis}
      />

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


