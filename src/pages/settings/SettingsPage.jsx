import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Banknote,
  Building2,
  ChevronDown,
  Database,
  FileText,
  Landmark,
  ListTree,
  Percent,
  ReceiptText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react"

import Badge from "../../components/ui/Badge"
import Card from "../../components/ui/Card"
import { SETTINGS_GROUPS } from "../../constants/settingsGroups"
import {
  assignCashCustodian,
  getCashCustodianAssignmentOptions,
  removeCashCustodianAssignment,
} from "../../features/cash-boxes/cashBoxes.api"
import { getSettings, updateSettingByScopeKey } from "../../features/settings/settings.api"
import IncentiveAccountSettingsV2 from "../../features/incentives/IncentiveAccountSettingsV2"
import IncentiveProgramRulesSettingsV2 from "../../features/incentives/IncentiveProgramRulesSettingsV2"
import IncentiveProgramSchedulesSettingsV2 from "../../features/incentives/IncentiveProgramSchedulesSettingsV2"
import DatabaseBackupRecoverySection from "../../features/backup/DatabaseBackupRecoverySection"
import {
  findSettingByKey,
  formatReadableText,
  getFriendlySettingDescription,
  getFriendlySettingName,
  getFriendlySettingValue,
  groupSettingsForDisplay,
} from "../../features/settings/settings.utils"

const ICONS = {
  "Database Backup & Disaster Recovery": Database,
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
  "All Saved Database Values": ListTree,
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

const SERVICE_DEFAULT_RULES = {
  requireCustomer: false,
  requireTechnicianAssignment: false,
  requireFinalChargeOnCompletion: true,
  requireCancellationReason: true,
  allowPaymentOnlyWhenCompleted: true,
  requireExactPaymentAmount: true,
}

const INVENTORY_DEFAULT_RULES = {
  blockNegativeStock: true,
  useItemMinimumStock: true,
  useItemReorderLevel: true,
  requireAdjustmentRemarks: true,
  requireOwnerApprovalForAdjustment: false,
  showLowStockAlerts: true,
}

const DISCOUNT_DEFAULT_RULES = {
  discountMode: "AMOUNT_ONLY",
  allowLineItemDiscount: true,
  allowPercentageDiscount: false,
  requireRemarks: false,
  requireOwnerApproval: false,
}

const PRICE_TIER_DEFAULT_LABELS = {
  1: "Price 1",
  2: "Price 2",
  3: "Price 3",
  4: "Price 4",
  5: "Price 5",
}

const PAYMENT_METHODS_DEFAULT_VALUE = {
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
    <article className={`rounded-2xl border bg-white p-4 transition shadow-2xs ${isOpen ? "border-[var(--color-maroon)] ring-1 ring-[var(--color-maroon)]" : "border-slate-200 hover:border-slate-300"}`}>
      <button
        aria-expanded={isOpen}
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-[var(--color-maroon)] border border-rose-100">
            <Icon className="size-4" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-xs text-slate-900">{title}</p>
              {badge ? <span className="inline-flex rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-[var(--color-maroon)]">{badge}</span> : null}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {description}
            </p>
          </div>
        </div>

        <ChevronDown
          className={`mt-1 size-4 shrink-0 text-slate-400 transition ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen ? <div className="mt-4 pt-3.5 border-t border-slate-100">{children}</div> : null}
    </article>
  )
}

function SavedSettingItem({ setting }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-3 text-xs">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-bold text-slate-900">
            {getFriendlySettingName(setting)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {getFriendlySettingDescription(setting)}
          </p>
        </div>

        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${setting.isEditable ? "bg-rose-50 text-[var(--color-maroon)] border border-rose-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
          {setting.isEditable ? "Can be changed" : "Locked"}
        </span>
      </div>

      <div className="mt-2.5 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-xs font-semibold text-slate-800">
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
    // Keep the editable draft aligned with the latest saved setting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      const scopeKey = setting?.scopeKey || "GLOBAL:receipt.business_name"
      const response = await updateSettingByScopeKey(scopeKey, {
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
            className="mt-2 h-12 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)] disabled:bg-[var(--color-soft)]"
            disabled={!canManageSettings || isSaving}
            onChange={(event) => setValue(event.target.value)}
            type="text"
            value={value}
          />
        </label>

        {!canManageSettings ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
            Only Super Owner or Admin can change this setting.
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
            className="h-12 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 text-sm font-bold text-[var(--color-text-strong)] shadow-card transition hover:bg-[var(--color-soft)]"
            disabled={isSaving}
            onClick={() => {
              setValue(setting?.value || "")
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
  const [values, setValues] = useState({
    STRAIGHT: 0.96,
    MONTH_3: 0.96,
    MONTH_6: 0.935,
    MONTH_9: 0.905,
    MONTH_12: 0.875,
    MONTH_18: 0.815,
    MONTH_24: 0.755,
  })
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (setting?.value && typeof setting.value === "object") {
      setValues(setting.value)
    }
  }, [setting])

  const handleChange = (termKey, inputValue) => {
    setValues((currentValues) => ({
      ...currentValues,
      [termKey]: inputValue,
    }))
  }

  const handleReset = () => {
    const currentValue = setting?.value && typeof setting.value === "object" ? setting.value : {
      STRAIGHT: 0.96,
      MONTH_3: 0.96,
      MONTH_6: 0.935,
      MONTH_9: 0.905,
      MONTH_12: 0.875,
      MONTH_18: 0.815,
      MONTH_24: 0.755,
    }
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

    const oldValue = JSON.stringify(setting?.value || {})
    const newValue = JSON.stringify(nextValue)

    if (oldValue === newValue) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const scopeKey = setting?.scopeKey || "GLOBAL:installment.term_basis"
      const response = await updateSettingByScopeKey(scopeKey, {
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
            Owner and admin configured terms and percentages. Sales staff choose from these rates.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          {canManageSettings ? "Configure terms" : "Viewing only"}
        </div>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSave}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {INSTALLMENT_TERMS.map((term) => (
            <label className="block" key={term.key}>
              <span className="text-sm font-bold text-[var(--color-text-strong)]">
                {term.label}
              </span>
              <div className="mt-2">
                <input
                  className="h-12 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)] disabled:bg-[var(--color-soft)]"
                  disabled={!canManageSettings || isSaving}
                  inputMode="decimal"
                  min="0.0001"
                  onChange={(event) => handleChange(term.key, event.target.value)}
                  placeholder="e.g. 0.755"
                  step="any"
                  type="number"
                  value={values[term.key] ?? ""}
                />
              </div>
            </label>
          ))}
        </div>

        {!canManageSettings ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
            Only Super Owner or Admin can change installment rates.
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
            className="h-12 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 text-sm font-bold text-[var(--color-text-strong)] shadow-card transition hover:bg-[var(--color-soft)]"
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

function SystemPreferencesDisplay({ setting }) {
  const isEnabled = Boolean(setting?.value)

  return (
    <Card className="border-[var(--color-border)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Badge tone="gray">View only</Badge>
          <h2 className="mt-3 text-xl font-bold text-[var(--color-text-strong)]">
            System Preferences
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            This shows current system behavior that affects branch settings.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          Current setup
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
        This is shown as view-only until the branch settings flow is fully connected.
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-bold text-[var(--color-text-strong)]">
              Branch-specific settings
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
              Settings can be prepared separately per branch when the branch-specific setup is enabled.
            </p>
          </div>

          <Badge tone={isEnabled ? "green" : "gray"}>
            {isEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </div>
    </Card>
  )
}
function DocumentNumberingDisplay({ setting }) {
  const defaultNumbering = {
    receipt: { label: "Sales Receipt", prefix: "RCPT" },
    quotation: { label: "Quotation", prefix: "QT" },
    service: { label: "Service Job", prefix: "SVC" },
    servicePayment: { label: "Service Payment", prefix: "SVCPAY" },
    warranty: { label: "Warranty Claim", prefix: "WTY" },
    transfer: { label: "Stock Transfer", prefix: "TR" },
    purchaseOrder: { label: "Purchase Order", prefix: "PO" },
    receiving: { label: "Purchase Receiving", prefix: "REC" },
  }

  const numbering = setting?.value && typeof setting.value === "object" ? setting.value : defaultNumbering

  const rows = Object.entries(numbering).map(([key, value]) => {
    const prefix = value?.prefix || "-"
    const sampleByPrefix = {
      RCPT: "00001",
      QT: "QT-MAIN-20260808-0001",
      SVC: "SVC-MAIN-20260808-0001",
      SVCPAY: "SVCPAY-MAIN-20260808-0001",
      WTY: "WTY-MAIN-20260808-0001",
      TR: "TR-MAIN-0001",
      PO: "PO-MAIN-0001",
      REC: "REC-MAIN-0001",
    }

    return {
      key,
      label: value?.label || key,
      prefix,
      sample: sampleByPrefix[prefix] || `${prefix}-MAIN-0001`,
    }
  })

  return (
    <Card className="border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon-soft)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Badge tone="maroon">Display only</Badge>
          <h2 className="mt-3 text-xl font-bold text-[var(--color-text-strong)]">
            Document Numbering
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            This shows how document numbers appear when records are created.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          Current numbering guide
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
        These are the current numbering examples used by the system.
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {rows.map((row) => (
          <div
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4"
            key={row.key}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-bold text-[var(--color-text-strong)]">{row.label}</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Starts with <span className="font-bold text-[var(--color-text-strong)]">{row.prefix}</span>
                </p>
              </div>

              <Badge tone="gray">View only</Badge>
            </div>

            <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm font-semibold text-[var(--color-text-strong)]">
              Example: {row.sample}
            </div>
          </div>
        ))}
      </div>
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

  const [custodianBranches, setCustodianBranches] = useState([])
  const [custodianDrafts, setCustodianDrafts] = useState({})
  const [isLoadingCustodians, setIsLoadingCustodians] = useState(false)
  const [savingCustodianBranchId, setSavingCustodianBranchId] = useState("")
  const [custodianMessage, setCustodianMessage] = useState("")
  const [custodianErrorMessage, setCustodianErrorMessage] = useState("")

  useEffect(() => {
    // Keep the editable draft aligned with the latest saved setting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRequireHandover(Boolean(requireHandoverSetting?.value))
  }, [requireHandoverSetting])

  const refreshCustodianOptions = useCallback(
    async ({ silent = false } = {}) => {
      if (!canManageSettings) return

      if (!silent) {
        setIsLoadingCustodians(true)
      }

      setCustodianErrorMessage("")

      try {
        const response = await getCashCustodianAssignmentOptions()

        if (
          !response?.success ||
          !Array.isArray(response?.data?.branches)
        ) {
          throw new Error(
            "Unable to load cash custodian assignment options.",
          )
        }

        const branches = response.data.branches

        setCustodianBranches(branches)
        setCustodianDrafts(
          Object.fromEntries(
            branches.map((branch) => [
              branch.id,
              branch.activeAssignment?.userId || "",
            ]),
          ),
        )
      } catch (error) {
        setCustodianErrorMessage(
          error?.response?.data?.error?.message ||
            error?.response?.data?.message ||
            error?.message ||
            "Unable to load cash custodian assignment options.",
        )
      } finally {
        if (!silent) {
          setIsLoadingCustodians(false)
        }
      }
    },
    [canManageSettings],
  )

  useEffect(() => {
    if (!canManageSettings) return

    const timeoutId = window.setTimeout(() => {
      void refreshCustodianOptions()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [canManageSettings, refreshCustodianOptions])

  const defaultPaymentStatus = formatReadableText(
    String(defaultPaymentStatusSetting?.value || "PENDING_HANDOVER"),
  )

  const lockedRules = [
    {
      label: "Handover starts as Pending",
      description:
        "Cash handover must be received before it is treated as completed.",
    },
    {
      label: "Insufficient cash is blocked",
      description:
        "Cash out and handover out cannot exceed the current cash box balance.",
    },
    {
      label: "Cash movement is recorded",
      description:
        "Received handover creates a cash transaction and updates the cash box balance.",
    },
    {
      label: "Cancelled cash transactions are reversed",
      description:
        "Cancellation restores the affected cash balance when allowed.",
    },
  ]

  const getAccountTypeLabel = (member) => {
    if (!member) return "Staff"

    if (member.role === "CASHIER") {
      return member.incentiveClassification === "SENIOR_SALES_AGENT"
        ? "Senior Sales Agent"
        : "Sales Agent"
    }

    if (member.role === "TECHNICIAN") {
      return member.incentiveClassification === "SENIOR_TECHNICIAN"
        ? "Senior Technician"
        : "Technician"
    }

    return String(member.role || "Staff").replaceAll("_", " ")
  }

  const formatAssignmentTime = (value) => {
    if (!value) return "—"

    const date = new Date(value)

    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleString("en-PH")
  }

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
      setErrorMessage(
        "Only Main Admin or Admin can change cash box rules.",
      )
      return
    }

    const cleanedValue = Boolean(requireHandover)

    if (
      cleanedValue ===
      Boolean(requireHandoverSetting?.value)
    ) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const scopeKey = requireHandoverSetting?.scopeKey || "GLOBAL:cash_box.require_handover_confirmation"
      const response = await updateSettingByScopeKey(
        scopeKey,
        {
          value: cleanedValue,
        },
      )

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

  const handleAssignCustodian = async (branch) => {
    const userId = custodianDrafts[branch.id] || ""

    setCustodianMessage("")
    setCustodianErrorMessage("")

    if (!userId) {
      setCustodianErrorMessage(
        `Select a cash custodian for ${branch.code}.`,
      )
      return
    }

    setSavingCustodianBranchId(branch.id)

    try {
      const response = await assignCashCustodian({
        branchId: branch.id,
        userId,
      })

      if (!response?.success || !response?.data) {
        throw new Error("Unable to assign cash custodian.")
      }

      const staffMember = branch.eligibleStaff?.find(
        (member) => member.id === userId,
      )

      setCustodianMessage(
        `${
          staffMember?.fullName || "Staff member"
        } is now the cash custodian for ${branch.code}.`,
      )

      await refreshCustodianOptions({ silent: true })
    } catch (error) {
      setCustodianErrorMessage(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Unable to assign cash custodian.",
      )
    } finally {
      setSavingCustodianBranchId("")
    }
  }

  const handleRemoveCustodian = async (branch) => {
    const currentName =
      branch.activeAssignment?.user?.fullName ||
      "the current custodian"

    const confirmed = window.confirm(
      `Remove ${currentName} as cash custodian for ${branch.code}?`,
    )

    if (!confirmed) return

    setCustodianMessage("")
    setCustodianErrorMessage("")
    setSavingCustodianBranchId(branch.id)

    try {
      const response =
        await removeCashCustodianAssignment({
          branchId: branch.id,
          reason: "REMOVED_FROM_SETTINGS",
        })

      if (!response?.success || !response?.data) {
        throw new Error(
          "Unable to remove cash custodian assignment.",
        )
      }

      setCustodianMessage(
        `Cash custodian assignment for ${branch.code} was removed.`,
      )

      await refreshCustodianOptions({ silent: true })
    } catch (error) {
      setCustodianErrorMessage(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          "Unable to remove cash custodian assignment.",
      )
    } finally {
      setSavingCustodianBranchId("")
    }
  }

  return (
    <Card className="border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon-soft)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Badge tone="maroon">
            {canManageSettings ? "Editable" : "Viewing only"}
          </Badge>

          <h2 className="mt-3 text-xl font-bold text-[var(--color-text-strong)]">
            Cash Box Rules
          </h2>

          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Control cash handover confirmation and assign the
            active cash custodian for each branch.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)]">
          Cash safeguards
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
          <p className="font-bold text-[var(--color-text-strong)]">
            Default payment status
          </p>

          <p className="mt-2 text-lg font-bold text-[var(--color-maroon)]">
            {defaultPaymentStatus}
          </p>

          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Display only for now. This will not be editable until
            the related business flow is fully confirmed.
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
            {requireHandover ? (
              <span className="size-2 rounded-full bg-white" />
            ) : null}
          </span>

          <span className="min-w-0">
            <span className="block font-bold text-[var(--color-text-strong)]">
              Require cash handover confirmation
            </span>

            <span className="mt-1 block text-sm leading-6 text-[var(--color-muted)]">
              Requires confirmation before handed-over cash is
              treated as received.
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
          Only Main Admin or Admin can change cash box rules.
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
          {!canManageSettings
            ? "View Only"
            : isSaving
              ? "Saving..."
              : "Save Cash Box Rules"}
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

      <div className="my-7 border-t border-[var(--color-border)]" />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Badge tone="maroon">Assignment</Badge>

          <h3 className="mt-3 text-lg font-bold text-[var(--color-text-strong)]">
            Assign Cash Custodian
          </h3>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
            Main Admin or Admin can assign one active Sales Agent,
            Senior Sales Agent, Technician, or Senior Technician
            as the current cash custodian for a branch.
          </p>
        </div>

        {canManageSettings ? (
          <button
            className="h-11 rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm font-bold text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              isLoadingCustodians ||
              Boolean(savingCustodianBranchId)
            }
            onClick={() => void refreshCustodianOptions()}
            type="button"
          >
            {isLoadingCustodians
              ? "Refreshing..."
              : "Refresh Assignments"}
          </button>
        ) : null}
      </div>

      {!canManageSettings ? (
        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 text-sm font-semibold text-[var(--color-muted)]">
          Cash custodian assignment is available only to Main
          Admin and Admin.
        </div>
      ) : null}

      {canManageSettings && isLoadingCustodians ? (
        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-5 text-sm font-semibold text-[var(--color-muted)]">
          Loading branch custodian assignments...
        </div>
      ) : null}

      {canManageSettings &&
      !isLoadingCustodians &&
      custodianBranches.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-5 text-sm font-semibold text-[var(--color-muted)]">
          No active branch is available for cash custodian
          assignment.
        </div>
      ) : null}

      {canManageSettings &&
      !isLoadingCustodians &&
      custodianBranches.length > 0 ? (
        <div className="mt-4 grid gap-4">
          {custodianBranches.map((branch) => {
            const assignment = branch.activeAssignment
            const assignedUser = assignment?.user || null
            const selectedUserId =
              custodianDrafts[branch.id] || ""
            const isBranchSaving =
              savingCustodianBranchId === branch.id
            const selectionUnchanged =
              Boolean(assignment) &&
              assignment.userId === selectedUserId

            return (
              <div
                className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-card"
                key={branch.id}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-maroon)]">
                      {branch.code}
                    </p>

                    <h4 className="mt-1 text-base font-bold text-[var(--color-text-strong)]">
                      {branch.name}
                    </h4>
                  </div>

                  <Badge
                    tone={assignment ? "green" : "neutral"}
                  >
                    {assignment
                      ? "Custodian Assigned"
                      : "No Custodian"}
                  </Badge>
                </div>

                <div className="mt-4 rounded-2xl bg-[var(--color-soft)] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-muted)]">
                    Current Custodian
                  </p>

                  {assignedUser ? (
                    <>
                      <p className="mt-2 font-bold text-[var(--color-text-strong)]">
                        {assignedUser.fullName}
                      </p>

                      <p className="mt-1 text-sm font-semibold text-[var(--color-maroon)]">
                        {getAccountTypeLabel(assignedUser)}
                      </p>

                      <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
                        Assigned{" "}
                        {formatAssignmentTime(
                          assignment.assignedAt,
                        )}
                        {assignment.assignedBy?.fullName
                          ? ` by ${assignment.assignedBy.fullName}`
                          : ""}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-[var(--color-muted)]">
                      No active cash custodian is assigned to this
                      branch.
                    </p>
                  )}
                </div>

                <label className="mt-4 block">
                  <span className="mb-2 block text-sm font-bold text-[var(--color-text-strong)]">
                    Select staff member
                  </span>

                  <select
                    className="h-12 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)]"
                    disabled={
                      isBranchSaving ||
                      branch.eligibleStaff?.length === 0
                    }
                    onChange={(event) =>
                      setCustodianDrafts((current) => ({
                        ...current,
                        [branch.id]: event.target.value,
                      }))
                    }
                    value={selectedUserId}
                  >
                    <option value="">
                      Select cash custodian
                    </option>

                    {(branch.eligibleStaff || []).map(
                      (member) => (
                        <option
                          key={member.id}
                          value={member.id}
                        >
                          {member.fullName} —{" "}
                          {getAccountTypeLabel(member)}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                {branch.eligibleStaff?.length === 0 ? (
                  <p className="mt-2 text-sm font-semibold text-amber-700">
                    No eligible active Sales Agent or Technician
                    account is available for this branch.
                  </p>
                ) : null}

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    className="h-11 rounded-2xl bg-[var(--color-maroon)] px-5 text-sm font-bold text-white transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      isBranchSaving ||
                      !selectedUserId ||
                      selectionUnchanged
                    }
                    onClick={() =>
                      void handleAssignCustodian(branch)
                    }
                    type="button"
                  >
                    {isBranchSaving
                      ? "Saving..."
                      : selectionUnchanged
                        ? "Currently Assigned"
                        : assignment
                          ? "Change Custodian"
                          : "Assign Custodian"}
                  </button>

                  {assignment ? (
                    <button
                      className="h-11 rounded-2xl border border-red-200 bg-white px-5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isBranchSaving}
                      onClick={() =>
                        void handleRemoveCustodian(branch)
                      }
                      type="button"
                    >
                      Remove Assignment
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {custodianMessage ? (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {custodianMessage}
        </div>
      ) : null}

      {custodianErrorMessage ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {custodianErrorMessage}
        </div>
      ) : null}
    </Card>
  )
}
function ServiceRulesForm({ setting, onSaved, canManageSettings = false }) {
  const [rules, setRules] = useState(SERVICE_DEFAULT_RULES)
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (setting?.value && typeof setting.value === "object") {
      // Keep the editable draft aligned with the latest saved setting.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRules({
        ...SERVICE_DEFAULT_RULES,
        ...setting.value,
        requireFinalChargeOnCompletion: true,
        requireCancellationReason: true,
        allowPaymentOnlyWhenCompleted: true,
        requireExactPaymentAmount: true,
      })
    }
  }, [setting])

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
    const currentValue = setting?.value && typeof setting.value === "object" ? {
      ...SERVICE_DEFAULT_RULES,
      ...setting.value,
      requireFinalChargeOnCompletion: true,
      requireCancellationReason: true,
      allowPaymentOnlyWhenCompleted: true,
      requireExactPaymentAmount: true,
    } : SERVICE_DEFAULT_RULES

    setRules(currentValue)
    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async () => {
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner or Admin can change service rules.")
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
      ...SERVICE_DEFAULT_RULES,
      ...(setting?.value || {}),
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
      const scopeKey = setting?.scopeKey || "GLOBAL:service.rules"
      const response = await updateSettingByScopeKey(scopeKey, {
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
      majorPartsMonths: majorPartsSetting?.value ?? 12,
      accessoriesDays: accessoriesSetting?.value ?? 7,
      outrightReplacementDays: outrightReplacementSetting?.value ?? 7,
    })
  }, [majorPartsSetting, accessoriesSetting, outrightReplacementSetting])

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
      majorPartsMonths: majorPartsSetting?.value ?? 12,
      accessoriesDays: accessoriesSetting?.value ?? 7,
      outrightReplacementDays: outrightReplacementSetting?.value ?? 7,
    })
    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async () => {
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner or Admin can change warranty rules.")
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
      cleanedValues.majorPartsMonths === Number(majorPartsSetting?.value) &&
      cleanedValues.accessoriesDays === Number(accessoriesSetting?.value) &&
      cleanedValues.outrightReplacementDays === Number(outrightReplacementSetting?.value)

    if (noChanges) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const updates = []

      if (cleanedValues.majorPartsMonths !== Number(majorPartsSetting?.value)) {
        const scopeKey = majorPartsSetting?.scopeKey || "GLOBAL:warranty.major_parts_months"
        updates.push(
          updateSettingByScopeKey(scopeKey, {
            value: cleanedValues.majorPartsMonths,
          }),
        )
      }

      if (cleanedValues.accessoriesDays !== Number(accessoriesSetting?.value)) {
        const scopeKey = accessoriesSetting?.scopeKey || "GLOBAL:warranty.accessories_days"
        updates.push(
          updateSettingByScopeKey(scopeKey, {
            value: cleanedValues.accessoriesDays,
          }),
        )
      }

      if (cleanedValues.outrightReplacementDays !== Number(outrightReplacementSetting?.value)) {
        const scopeKey = outrightReplacementSetting?.scopeKey || "GLOBAL:warranty.outright_replacement_days"
        updates.push(
          updateSettingByScopeKey(scopeKey, {
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
  const [rules, setRules] = useState(INVENTORY_DEFAULT_RULES)
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (setting?.value && typeof setting.value === "object") {
      // Keep the editable draft aligned with the latest saved setting.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRules({
        ...INVENTORY_DEFAULT_RULES,
        ...setting.value,
        blockNegativeStock: true,
      })
    }
  }, [setting])

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
    const currentValue = setting?.value && typeof setting.value === "object" ? {
      ...INVENTORY_DEFAULT_RULES,
      ...setting.value,
      blockNegativeStock: true,
    } : INVENTORY_DEFAULT_RULES

    setRules(currentValue)
    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async () => {
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner or Admin can change inventory rules.")
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
      ...INVENTORY_DEFAULT_RULES,
      ...(setting?.value || {}),
      blockNegativeStock: true,
    })
    const newValue = JSON.stringify(cleanedRules)

    if (oldValue === newValue) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const scopeKey = setting?.scopeKey || "GLOBAL:inventory.rules"
      const response = await updateSettingByScopeKey(scopeKey, {
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
  const [rules, setRules] = useState(DISCOUNT_DEFAULT_RULES)
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (setting?.value && typeof setting.value === "object") {
      // Keep the editable draft aligned with the latest saved setting.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRules({
        ...DISCOUNT_DEFAULT_RULES,
        ...setting.value,
        discountMode: "AMOUNT_ONLY",
        allowPercentageDiscount: false,
      })
    }
  }, [setting])

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
      description: "Not enabled yet because current discount handling uses amount-only rules.",
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
    const currentValue = setting?.value && typeof setting.value === "object" ? {
      ...DISCOUNT_DEFAULT_RULES,
      ...setting.value,
      discountMode: "AMOUNT_ONLY",
      allowPercentageDiscount: false,
    } : DISCOUNT_DEFAULT_RULES

    setRules(currentValue)
    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async () => {
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner or Admin can change discount rules.")
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
      ...DISCOUNT_DEFAULT_RULES,
      ...(setting?.value || {}),
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
      const scopeKey = setting?.scopeKey || "GLOBAL:discount.rules"
      const response = await updateSettingByScopeKey(scopeKey, {
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
  const [labels, setLabels] = useState(PRICE_TIER_DEFAULT_LABELS)
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (setting?.value && typeof setting.value === "object") {
      // Keep the editable draft aligned with the latest saved setting.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLabels({
        ...PRICE_TIER_DEFAULT_LABELS,
        ...setting.value,
      })
    }
  }, [setting])

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
    const currentValue = setting?.value && typeof setting.value === "object" ? {
      ...PRICE_TIER_DEFAULT_LABELS,
      ...setting.value,
    } : PRICE_TIER_DEFAULT_LABELS

    setLabels(currentValue)
    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async () => {
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner or Admin can change price tier labels.")
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

    const oldValue = JSON.stringify(setting?.value || {})
    const newValue = JSON.stringify(cleanedLabels)

    if (oldValue === newValue) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const scopeKey = setting?.scopeKey || "GLOBAL:price.tier_labels"
      const response = await updateSettingByScopeKey(scopeKey, {
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
              className="mt-2 h-12 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 text-sm font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-[var(--color-maroon-soft)] disabled:cursor-not-allowed disabled:bg-[var(--color-soft)] disabled:text-[var(--color-muted)]"
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
          Only Super Owner or Admin can change price tier labels.
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
          className="h-12 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 text-sm font-bold text-[var(--color-text-strong)] shadow-card transition hover:bg-[var(--color-soft)]"
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
  const [paymentMethods, setPaymentMethods] = useState(PAYMENT_METHODS_DEFAULT_VALUE)
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (setting?.value && typeof setting.value === "object") {
      setPaymentMethods({
        ...PAYMENT_METHODS_DEFAULT_VALUE,
        ...setting.value,
        requiredFields: {
          ...PAYMENT_METHODS_DEFAULT_VALUE.requiredFields,
          ...(setting.value.requiredFields || {}),
        },
      })
    }
  }, [setting])

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
    const currentValue = setting?.value && typeof setting.value === "object" ? {
      ...PAYMENT_METHODS_DEFAULT_VALUE,
      ...setting.value,
      requiredFields: {
        ...PAYMENT_METHODS_DEFAULT_VALUE.requiredFields,
        ...(setting.value.requiredFields || {}),
      },
    } : PAYMENT_METHODS_DEFAULT_VALUE

    setPaymentMethods(currentValue)
    setMessage("")
    setErrorMessage("")
  }

  const handleSave = async () => {
    setMessage("")
    setErrorMessage("")

    if (!canManageSettings) {
      setErrorMessage("Only Super Owner or Admin can change payment methods.")
      return
    }

    const oldValue = JSON.stringify(setting?.value || {})
    const newValue = JSON.stringify(paymentMethods)

    if (oldValue === newValue) {
      setMessage("No changes to save.")
      return
    }

    setIsSaving(true)

    try {
      const scopeKey = setting?.scopeKey || "GLOBAL:payment.methods"
      const response = await updateSettingByScopeKey(scopeKey, {
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

function SoloSaleIncentiveRulesCard({ canManageSettings, onSaved, setting }) {
  const [soloPercent, setSoloPercent] = useState(1)
  const [servicePercent, setServicePercent] = useState(5)
  const [pcBuildPercent, setPcBuildPercent] = useState(2)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: "", text: "" })

  const settingValue = setting?.value || {}

  useEffect(() => {
    if (typeof settingValue.defaultSoloSaleIncentivePercent === "number") {
      setSoloPercent(settingValue.defaultSoloSaleIncentivePercent)
    }
    if (typeof settingValue.defaultServiceIncentivePercent === "number") {
      setServicePercent(settingValue.defaultServiceIncentivePercent)
    }
    if (typeof settingValue.defaultPcBuildTechIncentivePercent === "number") {
      setPcBuildPercent(settingValue.defaultPcBuildTechIncentivePercent)
    }
  }, [settingValue.defaultSoloSaleIncentivePercent, settingValue.defaultServiceIncentivePercent, settingValue.defaultPcBuildTechIncentivePercent])

  const handleSave = async (e) => {
    e?.preventDefault()
    if (!canManageSettings) return

    const numSolo = Number(soloPercent)
    const numService = Number(servicePercent)
    const numPcBuild = Number(pcBuildPercent)

    if (!Number.isFinite(numSolo) || numSolo < 0 || numSolo > 100 ||
        !Number.isFinite(numService) || numService < 0 || numService > 100 ||
        !Number.isFinite(numPcBuild) || numPcBuild < 0 || numPcBuild > 100) {
      setFeedback({ type: "error", text: "All incentive percentages must be between 0% and 100%." })
      return
    }

    try {
      setIsSaving(true)
      setFeedback({ type: "", text: "" })
      const updatedValue = {
        ...settingValue,
        defaultSoloSaleIncentivePercent: numSolo,
        defaultServiceIncentivePercent: numService,
        defaultPcBuildTechIncentivePercent: numPcBuild,
      }
      const response = await updateSettingByScopeKey(setting?.scopeKey || "GLOBAL:incentive.rules", { value: updatedValue })
      setFeedback({ type: "success", text: "All incentive percentage rates saved successfully!" })
      if (onSaved && response?.data) onSaved(response.data)
    } catch (error) {
      setFeedback({ type: "error", text: error?.response?.data?.message || "Failed to save incentive rates." })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="p-5 sm:p-6 border border-emerald-200 bg-emerald-50/20">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            🏆 Staff & Technician Incentive Rates (%)
          </h3>
          <p className="text-xs text-slate-600 mt-1">
            Configure percentage rates awarded to sales staff and technicians based on their attributed sales and services.
          </p>
        </div>

        <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-emerald-100">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase">
              Solo Sales Incentive (%)
            </label>
            <p className="text-[10px] text-slate-500 mb-1">For own attributed sales</p>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                disabled={!canManageSettings || isSaving}
                value={soloPercent}
                onChange={(e) => setSoloPercent(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 text-right pr-7 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">%</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase">
              Tech Service Incentive (%)
            </label>
            <p className="text-[10px] text-slate-500 mb-1">For service charge / labor</p>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                disabled={!canManageSettings || isSaving}
                value={servicePercent}
                onChange={(e) => setServicePercent(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 text-right pr-7 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">%</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase">
              Tech PC Build Incentive (%)
            </label>
            <p className="text-[10px] text-slate-500 mb-1">For assembling PC build</p>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                disabled={!canManageSettings || isSaving}
                value={pcBuildPercent}
                onChange={(e) => setPcBuildPercent(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900 text-right pr-7 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">%</span>
            </div>
          </div>

          {canManageSettings ? (
            <div className="sm:col-span-3 flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50 transition shadow-2xs"
              >
                {isSaving ? "Saving..." : "Save All Incentive Rates (%)"}
              </button>
            </div>
          ) : null}
        </form>

        {feedback.text ? (
          <p className={`mt-1 text-xs font-semibold ${feedback.type === "success" ? "text-emerald-800" : "text-red-700"}`}>
            {feedback.text}
          </p>
        ) : null}
      </div>
    </Card>
  )
}

function SettingsPage({ user }) {
  const [settings, setSettings] = useState([])
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [openPlannedGroup, setOpenPlannedGroup] = useState("")
  const [openSavedGroup, setOpenSavedGroup] = useState("")

  const canManageSettings = ["SUPER_OWNER", "ADMIN"].includes(user?.role)
  const canManageIncentives = ["SUPER_OWNER", "ADMIN"].includes(user?.role)

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

  const systemPreferenceSetting = useMemo(
    () => findSettingByKey(settings, "system.allow_branch_specific_settings"),
    [settings],
  )
  const documentNumberingSetting = useMemo(
    () => findSettingByKey(settings, "document.numbering"),
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

  const groupedSettings = useMemo(
    () => groupSettingsForDisplay(settings),
    [settings],
  )

  const handleSettingSaved = (updatedSetting) => {
    setSettings((currentSettings) =>
      currentSettings.map((setting) =>
        setting.id === updatedSetting.id ? updatedSetting : setting,
      ),
    )
  }

  const renderSettingsSectionContent = (group) => {
    switch (group.title) {
      case "Business Profile":
        return (
          <ReceiptBusinessNameForm
            canManageSettings={canManageSettings}
            onSaved={handleSettingSaved}
            setting={receiptBusinessName}
          />
        )

      case "Branch Settings":
        return <PlannedSettingsContent group={group} />

      case "Payment Methods":
        return (
          <PaymentMethodsSetupCard
            canManageSettings={canManageSettings}
            onSaved={handleSettingSaved}
            setting={paymentMethodsSetting}
          />
        )

      case "Installment / Interest Rates":
        return (
          <InstallmentRatesForm
            canManageSettings={canManageSettings}
            onSaved={handleSettingSaved}
            setting={installmentTermBasis}
          />
        )

      case "Price Tier Settings":
        return (
          <PriceTierLabelsForm
            canManageSettings={canManageSettings}
            onSaved={handleSettingSaved}
            setting={priceTierLabelsSetting}
          />
        )

      case "Discount Rules":
        return (
          <DiscountRulesForm
            canManageSettings={canManageSettings}
            onSaved={handleSettingSaved}
            setting={discountRulesSetting}
          />
        )

      case "Inventory Rules":
        return (
          <InventoryRulesForm
            canManageSettings={canManageSettings}
            onSaved={handleSettingSaved}
            setting={inventoryRulesSetting}
          />
        )

      case "Warranty Rules":
        return (
          <WarrantyRulesForm
            accessoriesSetting={warrantyAccessoriesSetting}
            canManageSettings={canManageSettings}
            majorPartsSetting={warrantyMajorPartsSetting}
            onSaved={handleSettingSaved}
            outrightReplacementSetting={warrantyOutrightReplacementSetting}
          />
        )

      case "Service Rules":
        return (
          <ServiceRulesForm
            canManageSettings={canManageSettings}
            onSaved={handleSettingSaved}
            setting={serviceRulesSetting}
          />
        )

      case "Cash Box Rules":
        return (
          <CashBoxRulesForm
            canManageSettings={canManageSettings}
            defaultPaymentStatusSetting={cashBoxDefaultPaymentStatusSetting}
            onSaved={handleSettingSaved}
            requireHandoverSetting={cashBoxRequireHandoverSetting}
          />
        )

      case "Incentive Rules":
        return (
          <>
            <SoloSaleIncentiveRulesCard
              canManageSettings={canManageSettings}
              onSaved={handleSettingSaved}
              setting={findSettingByKey(settings, "incentive.rules")}
            />

            <div className="mt-4">
              <IncentiveAccountSettingsV2
                canManage={canManageIncentives}
              />
            </div>

            <div className="mt-4">
              <IncentiveProgramRulesSettingsV2
                canManage={canManageIncentives}
              />
            </div>

            <div className="mt-4">
              <IncentiveProgramSchedulesSettingsV2
                canManage={canManageIncentives}
              />
            </div>
          </>
        )
      case "Document Numbering":
        return (
          <DocumentNumberingDisplay setting={documentNumberingSetting} />
        )

      case "System Preferences":
        return (
          <SystemPreferencesDisplay setting={systemPreferenceSetting} />
        )

      default:
        return <PlannedSettingsContent group={group} />
    }
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
            Configure business rules, payment terms, interest rates, and system backups.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-sm font-semibold text-[var(--color-muted)] shadow-card">
          {isLoading ? "Loading saved settings..." : `${settings.length} saved settings loaded`}
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-[var(--color-text-strong)] shadow-card">
        <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[var(--color-text-strong)]">Business values are controlled here</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              Interest rates, quotation computation, warranty duration, cash handling, receipt
              information, and branch-specific rules are configured in the sections below.
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--color-soft)] p-4 text-sm leading-6 text-[var(--color-text)]">
            {canManageSettings
              ? "You can update available settings. Save carefully."
              : "You can view settings. Only Main Admin or Admin can change them."}
          </div>
        </div>
      </section>

      {/* Database Backup & Disaster Recovery */}
      <DatabaseBackupRecoverySection user={user} />

      {/* Settings Sections - Editable cards where users can configure any value */}
      <section className="space-y-4">
        <Card>
          <h2 className="text-lg font-bold text-[var(--color-text-strong)]">
            Settings Sections
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
            Click any section below to configure and update business rules.
          </p>
        </Card>

        {SETTINGS_GROUPS.map((group) => {
          const Icon = ICONS[group.title] || Settings
          const isOpen = openPlannedGroup === group.title

          return (
            <ExpandableCard
              badge={group.priority ? "Priority" : null}
              description={group.description}
              icon={Icon}
              isOpen={isOpen}
              key={group.title}
              onToggle={() =>
                setOpenPlannedGroup((current) =>
                  current === group.title ? "" : group.title,
                )
              }
              title={group.title}
            >
              <div className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&>div]:shadow-none [&>div]:ring-0">
                {renderSettingsSectionContent(group)}
              </div>
            </ExpandableCard>
          )
        })}
      </section>

      {/* Current Saved Business Settings */}
      <section className="space-y-4">
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-strong)]">
                Current Saved Business Settings
              </h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Live values currently active across the system.
              </p>
            </div>
            <Badge tone="maroon">{settings.length} Settings</Badge>
          </div>

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
      </section>
    </div>
  )
}

export default SettingsPage
























