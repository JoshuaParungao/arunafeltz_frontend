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
  formatReadableText,
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

function CashBoxRulesForm({
  defaultPaymentStatusSetting,
  requireHandoverSetting,
  onSaved,
  canManageSettings = false,
}) {
  const [requireHandover, setRequireHandover] = useState(true)
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setRequireHandover(Boolean(requireHandoverSetting?.value))
  }, [requireHandoverSetting])

  if (!defaultPaymentStatusSetting || !requireHandoverSetting) return null

  const defaultPaymentStatus = formatReadableText(String(defaultPaymentStatusSetting.value || ""))

  const lockedRules = [
    {
      label: "Handover starts as Pending",
      description: "Cash handover must be received before it is treated as completed.",
    },
    {
      label: "Insufficient cash is blocked",
      description: "Cash out and handover out cannot exceed the current cash box balance.",
    },
    {
      label: "Cash movement is recorded",
      description: "Received handover creates a cash transaction and updates the cash box balance.",
    },
    {
      label: "Cancelled cash transactions are reversed",
      description: "Cancellation restores the affected cash balance when allowed.",
    },
  ]

  const handleToggle = () => {
    if (!canManageSettings || isSaving) return

    setRequireHandover((currentValue) => !currentValue)
    setMessage("")
    setErrorMessage("")
  }

  const handleReset = () => {
    setRequireHandover(Boolean(requireHandoverSetting?.value))
    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async () => {
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner can change cash box rules.")
      return
    }

    const cleanedValue = Boolean(requireHandover)

    if (cleanedValue === Boolean(requireHandoverSetting.value)) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const response = await updateSettingByScopeKey(requireHandoverSetting.scopeKey, {
        value: cleanedValue,
      })

      if (!response?.success || !response?.data) {
        throw new Error("Unable to save cash box rules.")
      }

      onSaved(response.data)
      setRequireHandover(cleanedValue)
      setMessage("Cash box rules saved successfully.")
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Unable to save cash box rules.",
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
            Cash Box Rules
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Control cash handover confirmation and view locked cash safety rules.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          Cash safeguards
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
          <p className="font-bold text-[var(--color-text-strong)]">Default payment status</p>
          <p className="mt-2 text-lg font-bold text-[var(--color-maroon)]">
            {defaultPaymentStatus}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Display only for now. This will not be editable until the backend usage is confirmed.
          </p>
        </div>

        <button
          className="flex w-full items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-left disabled:cursor-not-allowed disabled:opacity-80"
          disabled={!canManageSettings || isSaving}
          onClick={handleToggle}
          type="button"
        >
          <span
            className={`mt-1 grid size-5 shrink-0 place-items-center rounded-md border ${
              requireHandover
                ? "border-[var(--color-maroon)] bg-[var(--color-maroon)]"
                : "border-[var(--color-border)] bg-white"
            }`}
          >
            {requireHandover ? <span className="size-2 rounded-full bg-white" /> : null}
          </span>

          <span className="min-w-0">
            <span className="block font-bold text-[var(--color-text-strong)]">
              Require cash handover confirmation
            </span>
            <span className="mt-1 block text-sm leading-6 text-[var(--color-muted)]">
              Requires confirmation before handed-over cash is treated as received.
            </span>
          </span>
        </button>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {lockedRules.map((rule) => (
          <div
            className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4"
            key={rule.label}
          >
            <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-md border border-[var(--color-maroon)] bg-[var(--color-maroon)]">
              <span className="size-2 rounded-full bg-white" />
            </span>

            <span className="min-w-0">
              <span className="block font-bold text-[var(--color-text-strong)]">
                {rule.label}
              </span>
              <span className="mt-1 block text-sm leading-6 text-[var(--color-muted)]">
                {rule.description}
              </span>
            </span>
          </div>
        ))}
      </div>

      {!canManageSettings ? (
        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--color-muted)]">
          Only Super Owner can change cash box rules. You can still view the current rules.
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          className="h-12 rounded-2xl bg-[var(--color-maroon)] px-5 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canManageSettings || isSaving}
          onClick={handleSave}
          type="button"
        >
          {!canManageSettings ? "View Only" : isSaving ? "Saving..." : "Save Cash Box Rules"}
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
    </Card>
  )
}
function ServiceRulesForm({ setting, onSaved, canManageSettings = false }) {
  const defaultRules = {
    requireCustomer: false,
    requireTechnicianAssignment: false,
    requireFinalChargeOnCompletion: true,
    requireCancellationReason: true,
    allowPaymentOnlyWhenCompleted: true,
    requireExactPaymentAmount: true,
  }

  const [rules, setRules] = useState(defaultRules)
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (setting?.value && typeof setting.value === "object") {
      setRules({
        ...defaultRules,
        ...setting.value,
        requireFinalChargeOnCompletion: true,
        requireCancellationReason: true,
        allowPaymentOnlyWhenCompleted: true,
        requireExactPaymentAmount: true,
      })
    }
  }, [setting])

  if (!setting) return null

  const serviceRules = [
    {
      key: "requireCustomer",
      label: "Require customer",
      description: "Requires a customer record when creating a service job.",
      locked: false,
    },
    {
      key: "requireTechnicianAssignment",
      label: "Require technician assignment",
      description: "Requires assigning a technician when creating a service job.",
      locked: false,
    },
    {
      key: "requireFinalChargeOnCompletion",
      label: "Require final service charge on completion",
      description: "Locked because completed service jobs need a final charge.",
      locked: true,
    },
    {
      key: "requireCancellationReason",
      label: "Require cancellation reason",
      description: "Locked because cancelled service jobs need a reason.",
      locked: true,
    },
    {
      key: "allowPaymentOnlyWhenCompleted",
      label: "Allow payment only when completed",
      description: "Locked because service payment is accepted only after completion.",
      locked: true,
    },
    {
      key: "requireExactPaymentAmount",
      label: "Require exact payment amount",
      description: "Locked because payment must match the final service charge.",
      locked: true,
    },
  ]

  const handleToggle = (key, locked = false) => {
    if (!canManageSettings || locked) return

    setRules((currentValue) => ({
      ...currentValue,
      [key]: !currentValue[key],
      requireFinalChargeOnCompletion: true,
      requireCancellationReason: true,
      allowPaymentOnlyWhenCompleted: true,
      requireExactPaymentAmount: true,
    }))
    setMessage("")
    setErrorMessage("")
  }

  const handleReset = () => {
    if (setting?.value && typeof setting.value === "object") {
      setRules({
        ...defaultRules,
        ...setting.value,
        requireFinalChargeOnCompletion: true,
        requireCancellationReason: true,
        allowPaymentOnlyWhenCompleted: true,
        requireExactPaymentAmount: true,
      })
    }

    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async () => {
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner can change service rules.")
      return
    }

    const cleanedRules = {
      requireCustomer: Boolean(rules.requireCustomer),
      requireTechnicianAssignment: Boolean(rules.requireTechnicianAssignment),
      requireFinalChargeOnCompletion: true,
      requireCancellationReason: true,
      allowPaymentOnlyWhenCompleted: true,
      requireExactPaymentAmount: true,
    }

    const oldValue = JSON.stringify({
      ...defaultRules,
      ...setting.value,
      requireFinalChargeOnCompletion: true,
      requireCancellationReason: true,
      allowPaymentOnlyWhenCompleted: true,
      requireExactPaymentAmount: true,
    })
    const newValue = JSON.stringify(cleanedRules)

    if (oldValue === newValue) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const response = await updateSettingByScopeKey(setting.scopeKey, {
        value: cleanedRules,
      })

      if (!response?.success || !response?.data) {
        throw new Error("Unable to save service rules.")
      }

      onSaved(response.data)
      setRules(cleanedRules)
      setMessage("Service rules saved successfully.")
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Unable to save service rules.",
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
            Service Rules
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Control service job requirements. Locked rules are already enforced by the system.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          Service safeguards
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {serviceRules.map((rule) => (
          <button
            className="flex w-full items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-left disabled:cursor-not-allowed disabled:opacity-80"
            disabled={!canManageSettings || isSaving || rule.locked}
            key={rule.key}
            onClick={() => handleToggle(rule.key, rule.locked)}
            type="button"
          >
            <span
              className={`mt-1 grid size-5 shrink-0 place-items-center rounded-md border ${
                rules[rule.key]
                  ? "border-[var(--color-maroon)] bg-[var(--color-maroon)]"
                  : "border-[var(--color-border)] bg-white"
              }`}
            >
              {rules[rule.key] ? <span className="size-2 rounded-full bg-white" /> : null}
            </span>

            <span className="min-w-0">
              <span className="block font-bold text-[var(--color-text-strong)]">
                {rule.label}
              </span>
              <span className="mt-1 block text-sm leading-6 text-[var(--color-muted)]">
                {rule.description}
              </span>
            </span>
          </button>
        ))}
      </div>

      {!canManageSettings ? (
        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--color-muted)]">
          Only Super Owner can change service rules. You can still view the current rules.
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          className="h-12 rounded-2xl bg-[var(--color-maroon)] px-5 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canManageSettings || isSaving}
          onClick={handleSave}
          type="button"
        >
          {!canManageSettings ? "View Only" : isSaving ? "Saving..." : "Save Service Rules"}
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
    </Card>
  )
}
function WarrantyRulesForm({
  majorPartsSetting,
  accessoriesSetting,
  outrightReplacementSetting,
  onSaved,
  canManageSettings = false,
}) {
  const [values, setValues] = useState({
    majorPartsMonths: "",
    accessoriesDays: "",
    outrightReplacementDays: "",
  })
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setValues({
      majorPartsMonths: majorPartsSetting?.value ?? "",
      accessoriesDays: accessoriesSetting?.value ?? "",
      outrightReplacementDays: outrightReplacementSetting?.value ?? "",
    })
  }, [majorPartsSetting, accessoriesSetting, outrightReplacementSetting])

  if (!majorPartsSetting || !accessoriesSetting || !outrightReplacementSetting) return null

  const handleChange = (key, value) => {
    if (!canManageSettings) return

    setValues((currentValue) => ({
      ...currentValue,
      [key]: value,
    }))
    setMessage("")
    setErrorMessage("")
  }

  const handleReset = () => {
    setValues({
      majorPartsMonths: majorPartsSetting?.value ?? "",
      accessoriesDays: accessoriesSetting?.value ?? "",
      outrightReplacementDays: outrightReplacementSetting?.value ?? "",
    })
    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async () => {
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner can change warranty rules.")
      return
    }

    const cleanedValues = {
      majorPartsMonths: Number(values.majorPartsMonths),
      accessoriesDays: Number(values.accessoriesDays),
      outrightReplacementDays: Number(values.outrightReplacementDays),
    }

    const hasInvalidValue = Object.values(cleanedValues).some(
      (value) => !Number.isFinite(value) || value <= 0,
    )

    if (hasInvalidValue) {
      setErrorMessage("Warranty values must be greater than zero.")
      return
    }

    const noChanges =
      cleanedValues.majorPartsMonths === Number(majorPartsSetting.value) &&
      cleanedValues.accessoriesDays === Number(accessoriesSetting.value) &&
      cleanedValues.outrightReplacementDays === Number(outrightReplacementSetting.value)

    if (noChanges) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const updates = []

      if (cleanedValues.majorPartsMonths !== Number(majorPartsSetting.value)) {
        updates.push(
          updateSettingByScopeKey(majorPartsSetting.scopeKey, {
            value: cleanedValues.majorPartsMonths,
          }),
        )
      }

      if (cleanedValues.accessoriesDays !== Number(accessoriesSetting.value)) {
        updates.push(
          updateSettingByScopeKey(accessoriesSetting.scopeKey, {
            value: cleanedValues.accessoriesDays,
          }),
        )
      }

      if (cleanedValues.outrightReplacementDays !== Number(outrightReplacementSetting.value)) {
        updates.push(
          updateSettingByScopeKey(outrightReplacementSetting.scopeKey, {
            value: cleanedValues.outrightReplacementDays,
          }),
        )
      }

      const responses = await Promise.all(updates)

      responses.forEach((response) => {
        if (!response?.success || !response?.data) {
          throw new Error("Unable to save warranty rules.")
        }

        onSaved(response.data)
      })

      setValues(cleanedValues)
      setMessage("Warranty rules saved successfully.")
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Unable to save warranty rules.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const fields = [
    {
      key: "majorPartsMonths",
      label: "Major parts warranty",
      suffix: "months",
      description: "Default warranty duration for major parts.",
    },
    {
      key: "accessoriesDays",
      label: "Accessories warranty",
      suffix: "days",
      description: "Default warranty duration for accessories.",
    },
    {
      key: "outrightReplacementDays",
      label: "Outright replacement period",
      suffix: "days",
      description: "Default outright replacement period.",
    },
  ]

  return (
    <Card className="border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon-soft)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Badge tone="maroon">{canManageSettings ? "Editable" : "Viewing only"}</Badge>
          <h2 className="mt-3 text-xl font-bold text-[var(--color-text-strong)]">
            Warranty Rules
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Set default warranty durations used for items, accessories, and outright replacement.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          Warranty defaults
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {fields.map((field) => (
          <label
            className="block rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4"
            key={field.key}
          >
            <span className="text-sm font-bold text-[var(--color-text-strong)]">
              {field.label}
            </span>
            <div className="mt-3 flex items-center gap-3">
              <input
                className="h-12 min-w-0 flex-1 rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-[var(--color-maroon-soft)] disabled:cursor-not-allowed disabled:bg-white/70 disabled:text-[var(--color-muted)]"
                disabled={!canManageSettings || isSaving}
                min="1"
                onChange={(event) => handleChange(field.key, event.target.value)}
                step="1"
                type="number"
                value={values[field.key]}
              />
              <span className="shrink-0 text-sm font-bold text-[var(--color-muted)]">
                {field.suffix}
              </span>
            </div>
            <span className="mt-2 block text-sm leading-6 text-[var(--color-muted)]">
              {field.description}
            </span>
          </label>
        ))}
      </div>

      {!canManageSettings ? (
        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--color-muted)]">
          Only Super Owner can change warranty rules. You can still view the current warranty
          defaults.
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          className="h-12 rounded-2xl bg-[var(--color-maroon)] px-5 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canManageSettings || isSaving}
          onClick={handleSave}
          type="button"
        >
          {!canManageSettings ? "View Only" : isSaving ? "Saving..." : "Save Warranty Rules"}
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
    </Card>
  )
}
function InventoryRulesForm({ setting, onSaved, canManageSettings = false }) {
  const defaultRules = {
    blockNegativeStock: true,
    useItemMinimumStock: true,
    useItemReorderLevel: true,
    requireAdjustmentRemarks: true,
    requireOwnerApprovalForAdjustment: false,
    showLowStockAlerts: true,
  }

  const [rules, setRules] = useState(defaultRules)
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (setting?.value && typeof setting.value === "object") {
      setRules({
        ...defaultRules,
        ...setting.value,
        blockNegativeStock: true,
      })
    }
  }, [setting])

  if (!setting) return null

  const toggleRules = [
    {
      key: "blockNegativeStock",
      label: "Block negative stock",
      description: "Always prevents stock from going below zero.",
      locked: true,
    },
    {
      key: "useItemMinimumStock",
      label: "Use item minimum stock",
      description: "Uses each item's minimum stock value for monitoring.",
      locked: false,
    },
    {
      key: "useItemReorderLevel",
      label: "Use item reorder level",
      description: "Uses each item's reorder level for restocking guidance.",
      locked: false,
    },
    {
      key: "requireAdjustmentRemarks",
      label: "Require remarks for stock adjustments",
      description: "Staff must add a reason when adjusting stock quantity.",
      locked: false,
    },
    {
      key: "requireOwnerApprovalForAdjustment",
      label: "Require owner approval for adjustments",
      description: "Prepared for future approval workflow.",
      locked: false,
    },
    {
      key: "showLowStockAlerts",
      label: "Show low stock alerts",
      description: "Shows alerts when stock needs attention.",
      locked: false,
    },
  ]

  const handleToggle = (key, locked = false) => {
    if (!canManageSettings || locked) return

    setRules((currentValue) => ({
      ...currentValue,
      [key]: !currentValue[key],
      blockNegativeStock: true,
    }))
    setMessage("")
    setErrorMessage("")
  }

  const handleReset = () => {
    if (setting?.value && typeof setting.value === "object") {
      setRules({
        ...defaultRules,
        ...setting.value,
        blockNegativeStock: true,
      })
    }

    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async () => {
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner can change inventory rules.")
      return
    }

    const cleanedRules = {
      blockNegativeStock: true,
      useItemMinimumStock: Boolean(rules.useItemMinimumStock),
      useItemReorderLevel: Boolean(rules.useItemReorderLevel),
      requireAdjustmentRemarks: Boolean(rules.requireAdjustmentRemarks),
      requireOwnerApprovalForAdjustment: Boolean(rules.requireOwnerApprovalForAdjustment),
      showLowStockAlerts: Boolean(rules.showLowStockAlerts),
    }

    const oldValue = JSON.stringify({
      ...defaultRules,
      ...setting.value,
      blockNegativeStock: true,
    })
    const newValue = JSON.stringify(cleanedRules)

    if (oldValue === newValue) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const response = await updateSettingByScopeKey(setting.scopeKey, {
        value: cleanedRules,
      })

      if (!response?.success || !response?.data) {
        throw new Error("Unable to save inventory rules.")
      }

      onSaved(response.data)
      setRules(cleanedRules)
      setMessage("Inventory rules saved successfully.")
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Unable to save inventory rules.",
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
            Inventory Rules
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Control inventory safeguards and alerts. Negative stock is locked because the system
            already prevents stock from going below zero.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          Stock safety
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {toggleRules.map((rule) => (
          <button
            className="flex w-full items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-left disabled:cursor-not-allowed disabled:opacity-80"
            disabled={!canManageSettings || isSaving || rule.locked}
            key={rule.key}
            onClick={() => handleToggle(rule.key, rule.locked)}
            type="button"
          >
            <span
              className={`mt-1 grid size-5 shrink-0 place-items-center rounded-md border ${
                rules[rule.key]
                  ? "border-[var(--color-maroon)] bg-[var(--color-maroon)]"
                  : "border-[var(--color-border)] bg-white"
              }`}
            >
              {rules[rule.key] ? <span className="size-2 rounded-full bg-white" /> : null}
            </span>

            <span className="min-w-0">
              <span className="block font-bold text-[var(--color-text-strong)]">
                {rule.label}
              </span>
              <span className="mt-1 block text-sm leading-6 text-[var(--color-muted)]">
                {rule.description}
              </span>
            </span>
          </button>
        ))}
      </div>

      {!canManageSettings ? (
        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--color-muted)]">
          Only Super Owner can change inventory rules. You can still view the current rules.
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          className="h-12 rounded-2xl bg-[var(--color-maroon)] px-5 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canManageSettings || isSaving}
          onClick={handleSave}
          type="button"
        >
          {!canManageSettings ? "View Only" : isSaving ? "Saving..." : "Save Inventory Rules"}
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
    </Card>
  )
}
function DiscountRulesForm({ setting, onSaved, canManageSettings = false }) {
  const defaultRules = {
    discountMode: "AMOUNT_ONLY",
    allowLineItemDiscount: true,
    allowPercentageDiscount: false,
    requireRemarks: false,
    requireOwnerApproval: false,
  }

  const [rules, setRules] = useState(defaultRules)
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (setting?.value && typeof setting.value === "object") {
      setRules({
        ...defaultRules,
        ...setting.value,
        discountMode: "AMOUNT_ONLY",
        allowPercentageDiscount: false,
      })
    }
  }, [setting])

  if (!setting) return null

  const toggleRules = [
    {
      key: "allowLineItemDiscount",
      label: "Allow line item discount",
      description: "Allows discount amount per item line in POS and quotations.",
      locked: false,
    },
    {
      key: "requireRemarks",
      label: "Require remarks when discount is used",
      description: "Staff must add a note when giving a discount.",
      locked: false,
    },
    {
      key: "requireOwnerApproval",
      label: "Require owner approval",
      description: "Prepared for future approval workflow.",
      locked: false,
    },
    {
      key: "allowPercentageDiscount",
      label: "Allow percentage discount",
      description: "Not enabled yet because current backend computation is amount-only.",
      locked: true,
    },
  ]

  const handleToggle = (key, locked = false) => {
    if (!canManageSettings || locked) return

    setRules((currentValue) => ({
      ...currentValue,
      [key]: !currentValue[key],
      discountMode: "AMOUNT_ONLY",
      allowPercentageDiscount: false,
    }))
    setMessage("")
    setErrorMessage("")
  }

  const handleReset = () => {
    if (setting?.value && typeof setting.value === "object") {
      setRules({
        ...defaultRules,
        ...setting.value,
        discountMode: "AMOUNT_ONLY",
        allowPercentageDiscount: false,
      })
    }

    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async () => {
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner can change discount rules.")
      return
    }

    const cleanedRules = {
      discountMode: "AMOUNT_ONLY",
      allowLineItemDiscount: Boolean(rules.allowLineItemDiscount),
      allowPercentageDiscount: false,
      requireRemarks: Boolean(rules.requireRemarks),
      requireOwnerApproval: Boolean(rules.requireOwnerApproval),
    }

    const oldValue = JSON.stringify({
      ...defaultRules,
      ...setting.value,
      discountMode: "AMOUNT_ONLY",
      allowPercentageDiscount: false,
    })
    const newValue = JSON.stringify(cleanedRules)

    if (oldValue === newValue) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const response = await updateSettingByScopeKey(setting.scopeKey, {
        value: cleanedRules,
      })

      if (!response?.success || !response?.data) {
        throw new Error("Unable to save discount rules.")
      }

      onSaved(response.data)
      setRules(cleanedRules)
      setMessage("Discount rules saved successfully.")
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Unable to save discount rules.",
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
            Discount Rules
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Control how discounts are shown in POS and quotations. Current computation supports
            amount-based line discounts only.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          Amount only
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {toggleRules.map((rule) => (
          <button
            className="flex w-full items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-left disabled:cursor-not-allowed disabled:opacity-80"
            disabled={!canManageSettings || isSaving || rule.locked}
            key={rule.key}
            onClick={() => handleToggle(rule.key, rule.locked)}
            type="button"
          >
            <span
              className={`mt-1 grid size-5 shrink-0 place-items-center rounded-md border ${
                rules[rule.key]
                  ? "border-[var(--color-maroon)] bg-[var(--color-maroon)]"
                  : "border-[var(--color-border)] bg-white"
              }`}
            >
              {rules[rule.key] ? <span className="size-2 rounded-full bg-white" /> : null}
            </span>

            <span className="min-w-0">
              <span className="block font-bold text-[var(--color-text-strong)]">
                {rule.label}
              </span>
              <span className="mt-1 block text-sm leading-6 text-[var(--color-muted)]">
                {rule.description}
              </span>
            </span>
          </button>
        ))}
      </div>

      {!canManageSettings ? (
        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--color-muted)]">
          Only Super Owner can change discount rules. You can still view the current rules.
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          className="h-12 rounded-2xl bg-[var(--color-maroon)] px-5 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canManageSettings || isSaving}
          onClick={handleSave}
          type="button"
        >
          {!canManageSettings ? "View Only" : isSaving ? "Saving..." : "Save Discount Rules"}
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
    </Card>
  )
}
function PriceTierLabelsForm({ setting, onSaved, canManageSettings = false }) {
  const defaultLabels = {
    1: "Price 1",
    2: "Price 2",
    3: "Price 3",
    4: "Price 4",
    5: "Price 5",
  }

  const [labels, setLabels] = useState(defaultLabels)
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (setting?.value && typeof setting.value === "object") {
      setLabels({
        ...defaultLabels,
        ...setting.value,
      })
    }
  }, [setting])

  if (!setting) return null

  const handleChange = (tier, value) => {
    if (!canManageSettings) return

    setLabels((currentValue) => ({
      ...currentValue,
      [tier]: value,
    }))
    setMessage("")
    setErrorMessage("")
  }

  const handleReset = () => {
    if (setting?.value && typeof setting.value === "object") {
      setLabels({
        ...defaultLabels,
        ...setting.value,
      })
    }

    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async () => {
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner can change price tier labels.")
      return
    }

    const cleanedLabels = {
      1: String(labels[1] || "").trim(),
      2: String(labels[2] || "").trim(),
      3: String(labels[3] || "").trim(),
      4: String(labels[4] || "").trim(),
      5: String(labels[5] || "").trim(),
    }

    const hasEmptyLabel = Object.values(cleanedLabels).some((label) => !label)

    if (hasEmptyLabel) {
      setErrorMessage("All price tier labels are required.")
      return
    }

    const oldValue = JSON.stringify(setting.value)
    const newValue = JSON.stringify(cleanedLabels)

    if (oldValue === newValue) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const response = await updateSettingByScopeKey(setting.scopeKey, {
        value: cleanedLabels,
      })

      if (!response?.success || !response?.data) {
        throw new Error("Unable to save price tier labels.")
      }

      onSaved(response.data)
      setLabels(cleanedLabels)
      setMessage("Price tier labels saved successfully.")
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Unable to save price tier labels.",
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
            Price Tier Labels
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Rename Price 1 to Price 5 for easier use in POS, quotations, and inventory. This only
            changes the display names, not the actual item prices.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          Labels only
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((tier) => (
          <label className="block" key={tier}>
            <span className="text-sm font-bold text-[var(--color-text-strong)]">
              Price {tier}
            </span>
            <input
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-[var(--color-maroon-soft)] disabled:cursor-not-allowed disabled:bg-[var(--color-soft)] disabled:text-[var(--color-muted)]"
              disabled={!canManageSettings || isSaving}
              maxLength={40}
              onChange={(event) => handleChange(tier, event.target.value)}
              value={labels[tier] || ""}
            />
          </label>
        ))}
      </div>

      {!canManageSettings ? (
        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--color-muted)]">
          Only Super Owner can change price tier labels. You can still view the current labels.
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          className="h-12 rounded-2xl bg-[var(--color-maroon)] px-5 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canManageSettings || isSaving}
          onClick={handleSave}
          type="button"
        >
          {!canManageSettings ? "View Only" : isSaving ? "Saving..." : "Save Price Labels"}
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
    </Card>
  )
}
function PaymentMethodsSetupCard({ setting, onSaved, canManageSettings = false }) {
  const defaultValue = {
    cash: true,
    gcash: true,
    bankTransfer: true,
    cardTerminal: true,
    cheque: true,
    creditInstallment: true,
    mixedPayment: true,
    requiredFields: {
      referenceNumber: true,
      cardApprovalCode: true,
      chequeNumber: true,
      bankName: true,
      remarks: false,
    },
  }

  const [paymentMethods, setPaymentMethods] = useState(defaultValue)
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (setting?.value && typeof setting.value === "object") {
      setPaymentMethods({
        ...defaultValue,
        ...setting.value,
        requiredFields: {
          ...defaultValue.requiredFields,
          ...(setting.value.requiredFields || {}),
        },
      })
    }
  }, [setting])

  if (!setting) return null

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
    { key: "referenceNumber", label: "Reference number required" },
    { key: "cardApprovalCode", label: "Card approval code required" },
    { key: "chequeNumber", label: "Cheque number required" },
    { key: "bankName", label: "Bank name required" },
    { key: "remarks", label: "Remarks required" },
  ]

  const handlePaymentToggle = (key) => {
    if (!canManageSettings) return

    setPaymentMethods((currentValue) => ({
      ...currentValue,
      [key]: !currentValue[key],
    }))
    setMessage("")
    setErrorMessage("")
  }

  const handleRequiredFieldToggle = (key) => {
    if (!canManageSettings) return

    setPaymentMethods((currentValue) => ({
      ...currentValue,
      requiredFields: {
        ...currentValue.requiredFields,
        [key]: !currentValue.requiredFields[key],
      },
    }))
    setMessage("")
    setErrorMessage("")
  }

  const handleReset = () => {
    if (setting?.value && typeof setting.value === "object") {
      setPaymentMethods({
        ...defaultValue,
        ...setting.value,
        requiredFields: {
          ...defaultValue.requiredFields,
          ...(setting.value.requiredFields || {}),
        },
      })
    }

    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async () => {
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner can change payment methods.")
      return
    }

    const oldValue = JSON.stringify(setting.value)
    const newValue = JSON.stringify(paymentMethods)

    if (oldValue === newValue) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const response = await updateSettingByScopeKey(setting.scopeKey, {
        value: paymentMethods,
      })

      if (!response?.success || !response?.data) {
        throw new Error("Unable to save payment methods.")
      }

      onSaved(response.data)
      setMessage("Payment methods saved successfully.")
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Unable to save payment methods.",
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
            Payment Methods
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Choose accepted payment types and required payment details for POS and collections.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          {canManageSettings ? "Save carefully" : "Viewing only"}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <div>
          <h3 className="font-bold text-[var(--color-text-strong)]">Accepted payment types</h3>

          <div className="mt-3 space-y-3">
            {paymentOptions.map((option) => (
              <button
                className="flex w-full items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-left disabled:cursor-not-allowed disabled:opacity-80"
                disabled={!canManageSettings || isSaving}
                key={option.key}
                onClick={() => handlePaymentToggle(option.key)}
                type="button"
              >
                <span
                  className={`mt-1 grid size-5 shrink-0 place-items-center rounded-md border ${
                    paymentMethods[option.key]
                      ? "border-[var(--color-maroon)] bg-[var(--color-maroon)]"
                      : "border-[var(--color-border)] bg-white"
                  }`}
                >
                  {paymentMethods[option.key] ? <span className="size-2 rounded-full bg-white" /> : null}
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
                disabled={!canManageSettings || isSaving}
                key={field.key}
                onClick={() => handleRequiredFieldToggle(field.key)}
                type="button"
              >
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-md border ${
                    paymentMethods.requiredFields[field.key]
                      ? "border-[var(--color-maroon)] bg-[var(--color-maroon)]"
                      : "border-[var(--color-border)] bg-white"
                  }`}
                >
                  {paymentMethods.requiredFields[field.key] ? (
                    <span className="size-2 rounded-full bg-white" />
                  ) : null}
                </span>

                <span className="font-bold text-[var(--color-text-strong)]">
                  {field.label}
                </span>
              </button>
            ))}
          </div>

          {!canManageSettings ? (
            <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--color-muted)]">
              Only Super Owner can change payment methods. You can still view the current setup.
            </div>
          ) : null}

          {message ? (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              {message}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              className="h-12 rounded-2xl bg-[var(--color-maroon)] px-5 text-sm font-bold text-white shadow-soft transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canManageSettings || isSaving}
              onClick={handleSave}
              type="button"
            >
              {!canManageSettings ? "View Only" : isSaving ? "Saving..." : "Save Payment Methods"}
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

  const cashBoxDefaultPaymentStatusSetting = useMemo(
    () => findSettingByKey(settings, "cash_box.default_payment_status"),
    [settings],
  )

  const cashBoxRequireHandoverSetting = useMemo(
    () => findSettingByKey(settings, "cash_box.require_handover_confirmation"),
    [settings],
  )

  const serviceRulesSetting = useMemo(
    () => findSettingByKey(settings, "service.rules"),
    [settings],
  )

  const warrantyMajorPartsSetting = useMemo(
    () => findSettingByKey(settings, "warranty.major_parts_months"),
    [settings],
  )

  const warrantyAccessoriesSetting = useMemo(
    () => findSettingByKey(settings, "warranty.accessories_days"),
    [settings],
  )

  const warrantyOutrightReplacementSetting = useMemo(
    () => findSettingByKey(settings, "warranty.outright_replacement_days"),
    [settings],
  )

  const inventoryRulesSetting = useMemo(
    () => findSettingByKey(settings, "inventory.rules"),
    [settings],
  )

  const discountRulesSetting = useMemo(
    () => findSettingByKey(settings, "discount.rules"),
    [settings],
  )

  const priceTierLabelsSetting = useMemo(
    () => findSettingByKey(settings, "price.tier_labels"),
    [settings],
  )

  const paymentMethodsSetting = useMemo(
    () => findSettingByKey(settings, "payment.methods"),
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

      <CashBoxRulesForm
        canManageSettings={canManageSettings}
        defaultPaymentStatusSetting={cashBoxDefaultPaymentStatusSetting}
        onSaved={handleSettingSaved}
        requireHandoverSetting={cashBoxRequireHandoverSetting}
      />

      <ServiceRulesForm
        canManageSettings={canManageSettings}
        onSaved={handleSettingSaved}
        setting={serviceRulesSetting}
      />

      <WarrantyRulesForm
        accessoriesSetting={warrantyAccessoriesSetting}
        canManageSettings={canManageSettings}
        majorPartsSetting={warrantyMajorPartsSetting}
        onSaved={handleSettingSaved}
        outrightReplacementSetting={warrantyOutrightReplacementSetting}
      />

      <InventoryRulesForm
        canManageSettings={canManageSettings}
        onSaved={handleSettingSaved}
        setting={inventoryRulesSetting}
      />

      <DiscountRulesForm
        canManageSettings={canManageSettings}
        onSaved={handleSettingSaved}
        setting={discountRulesSetting}
      />

      <PriceTierLabelsForm
        canManageSettings={canManageSettings}
        onSaved={handleSettingSaved}
        setting={priceTierLabelsSetting}
      />

      <PaymentMethodsSetupCard
        canManageSettings={canManageSettings}
        onSaved={handleSettingSaved}
        setting={paymentMethodsSetting}
      />

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

















