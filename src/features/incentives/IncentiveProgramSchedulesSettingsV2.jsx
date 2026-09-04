import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Lock,
  RotateCcw,
  Save,
  ShoppingBag,
  Sliders,
  Wrench,
  Cpu,
} from "lucide-react"

import {
  createIncentiveProgramScheduleVersion,
  getIncentiveProgramSchedules,
  previewIncentiveProgramSchedule,
} from "./incentives.api"

const BUSINESS_TIME_ZONE = "Asia/Manila"

const PROGRAM_TYPES = ["ITEM_SALE", "ORDINARY_REPAIR", "BOARD_LEVEL_REPAIR"]

const PROGRAM_LABELS = {
  ITEM_SALE: "Item Sale Schedule",
  ORDINARY_REPAIR: "Ordinary Repair Schedule",
  BOARD_LEVEL_REPAIR: "Board Level Repair Schedule",
}

const PROGRAM_ICONS = {
  ITEM_SALE: ShoppingBag,
  ORDINARY_REPAIR: Wrench,
  BOARD_LEVEL_REPAIR: Cpu,
}

const SCHEDULE_TYPES = [
  { value: "EVERY_N_DAYS", label: "Every N Days" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "MANUAL", label: "Manual" },
]

function apiMessage(error, fallback) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

function dateOnlyValue(value) {
  if (!value) return ""
  if (typeof value === "string") return value.slice(0, 10)
  return ""
}

function getProgram(branchEntry, programType) {
  return (
    branchEntry?.programs?.find(
      (program) => program.programType === programType,
    ) || null
  )
}

function createProgramDraft(program) {
  const configuration = program?.configuration || {}

  return {
    scheduleType: configuration.scheduleType || "",
    anchorDate: dateOnlyValue(configuration.anchorDate),
    effectiveFrom: dateOnlyValue(configuration.effectiveFrom),
    everyNDays:
      configuration.everyNDays !== null && configuration.everyNDays !== undefined
        ? String(configuration.everyNDays)
        : "",
    claimOpenAfterDays:
      configuration.claimOpenAfterDays !== null &&
      configuration.claimOpenAfterDays !== undefined
        ? String(configuration.claimOpenAfterDays)
        : "",
    claimWindowDays:
      configuration.claimWindowDays !== null &&
      configuration.claimWindowDays !== undefined
        ? String(configuration.claimWindowDays)
        : "",
    notes: program?.latestSavedVersion?.notes || "",
  }
}

function createBranchDrafts(branchEntry) {
  return Object.fromEntries(
    PROGRAM_TYPES.map((programType) => [
      programType,
      createProgramDraft(getProgram(branchEntry, programType)),
    ]),
  )
}

function createBranchPreviews(branchEntry) {
  return Object.fromEntries(
    PROGRAM_TYPES.map((programType) => {
      const program = getProgram(branchEntry, programType)

      return [
        programType,
        {
          periods: Array.isArray(program?.configuration?.preview)
            ? [...program.configuration.preview]
            : [],
          manualRequired: Boolean(program?.configuration?.manualRequired),
        },
      ]
    }),
  )
}

function positiveInteger(value) {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 1) {
    return null
  }
  return numeric
}

function validateAndBuildPayload({
  branchId,
  draft,
  includePreviewCount = false,
}) {
  if (!branchId) {
    return { error: "A branch is required." }
  }

  if (!SCHEDULE_TYPES.some((type) => type.value === draft.scheduleType)) {
    return { error: "Pumili ng schedule type." }
  }

  if (!draft.anchorDate) {
    return { error: "Anchor Date is required." }
  }

  if (!draft.effectiveFrom) {
    return { error: "Effective From is required." }
  }

  const claimOpenAfterDays = positiveInteger(draft.claimOpenAfterDays)
  if (claimOpenAfterDays === null) {
    return { error: "Claim Opens After must be a positive whole number." }
  }

  const claimWindowDays = positiveInteger(draft.claimWindowDays)
  if (claimWindowDays === null) {
    return { error: "Claim Window must be a positive whole number." }
  }

  let everyNDays = null
  if (draft.scheduleType === "EVERY_N_DAYS") {
    everyNDays = positiveInteger(draft.everyNDays)
    if (everyNDays === null) {
      return { error: "Every N Days must be a positive whole number." }
    }
  }

  const payload = {
    branchId,
    scheduleType: draft.scheduleType,
    anchorDate: draft.anchorDate,
    effectiveFrom: draft.effectiveFrom,
    everyNDays,
    claimOpenAfterDays,
    claimWindowDays,
    notes: draft.notes.trim() || null,
  }

  if (includePreviewCount) {
    payload.count = 4
  }

  return { payload }
}

function PreviewPanel({ preview, scheduleType }) {
  if (scheduleType === "MANUAL" || preview?.manualRequired) {
    return (
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-800">
        Ang MANUAL schedule ay walang awtomatikong generated periods. Ang manual cutoff ay isasagawa sa active incentive cycle.
      </div>
    )
  }

  const periods = Array.isArray(preview?.periods) ? preview.periods : []
  if (!periods.length) return null

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
      <div className="bg-slate-50/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-slate-700">
          Preview ng Susunod na 4 Earning Periods
        </span>
        <span className="text-[11px] font-bold text-slate-500">
          Asia/Manila Schedule Time
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead className="bg-slate-50/50 text-slate-500 font-bold border-b border-slate-100">
            <tr>
              <th className="px-4 py-2.5">Period Code</th>
              <th className="px-4 py-2.5">Start Date</th>
              <th className="px-4 py-2.5">End Date</th>
              <th className="px-4 py-2.5">Cutoff Date</th>
              <th className="px-4 py-2.5">Claim Opens</th>
              <th className="px-4 py-2.5">Claim Closes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {periods.map((period, index) => (
              <tr
                className="hover:bg-slate-50/60 transition"
                key={period.periodCode || `${period.startDate}-${index}`}
              >
                <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px]">
                    {period.periodCode || "—"}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-slate-700">{period.startDate || "—"}</td>
                <td className="px-4 py-2.5 font-mono text-slate-700">{period.endDate || "—"}</td>
                <td className="px-4 py-2.5 font-mono font-bold text-[var(--color-maroon)]">
                  {period.cutoffDate || "—"}
                </td>
                <td className="px-4 py-2.5 font-mono text-emerald-700 font-bold">
                  {period.claimOpenDate || "—"}
                </td>
                <td className="px-4 py-2.5 font-mono text-slate-500">{period.claimCloseDate || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ScheduleCard({
  branch,
  program,
  draft,
  preview,
  canManage,
  busyAction,
  onDraftChange,
  onPreview,
  onReset,
  onSave,
}) {
  const programType = program.programType
  const isConfigured = program.configurationState === "CONFIGURED"
  const Icon = PROGRAM_ICONS[programType] || Calendar
  const isEveryNDays = draft.scheduleType === "EVERY_N_DAYS"

  return (
    <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-card transition-all hover:border-slate-300">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-[var(--color-maroon)] border border-rose-100/80 shadow-2xs">
            <Icon size={20} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-black text-slate-900">
                {PROGRAM_LABELS[programType]}
              </h4>

              {isConfigured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 size={12} />
                  Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
                  Not Configured
                </span>
              )}

              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50/70 border border-rose-200/60 px-2.5 py-0.5 text-[11px] font-black text-[var(--color-maroon)]">
                <Building2 size={12} />
                {branch.code} — {branch.name}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Independent cutoff at payout schedule para sa branch na ito.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 px-2.5 py-1 text-[11px] font-bold text-slate-500">
            <Clock size={11} className="text-slate-400" />
            {BUSINESS_TIME_ZONE}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 px-2.5 py-1 text-[11px] font-bold text-slate-500">
            <Lock size={11} className="text-slate-400" />
            Append-only versioned
          </span>
        </div>
      </div>

      {/* Main Form Fields */}
      <div className="mt-5 pt-5 border-t border-slate-100">
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Schedule Type */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
              Schedule Type
            </label>
            <select
              disabled={!canManage || Boolean(busyAction)}
              value={draft.scheduleType}
              onChange={(e) => onDraftChange("scheduleType", e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-rose-50 disabled:bg-slate-100"
            >
              <option value="">Pumili ng schedule type</option>
              {SCHEDULE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Anchor Date */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
              Anchor Date
            </label>
            <input
              type="date"
              disabled={!canManage || Boolean(busyAction)}
              value={draft.anchorDate}
              onChange={(e) => onDraftChange("anchorDate", e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-rose-50 disabled:bg-slate-100"
            />
          </div>

          {/* Effective From */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
              Effective From
            </label>
            <input
              type="date"
              disabled={!canManage || Boolean(busyAction)}
              value={draft.effectiveFrom}
              onChange={(e) => onDraftChange("effectiveFrom", e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-rose-50 disabled:bg-slate-100"
            />
          </div>
        </div>

        {/* Row 2: Interval / Every N Days & Claim Windows */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {isEveryNDays ? (
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                Every N Days
              </label>
              <div className="relative mt-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder="Hal. 14"
                  disabled={!canManage || Boolean(busyAction)}
                  value={draft.everyNDays}
                  onChange={(e) => onDraftChange("everyNDays", e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 pr-12 text-xs font-bold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-rose-50 disabled:bg-slate-100"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  days
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col justify-center">
              <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                Cycle Interval
              </p>
              <p className="mt-1 text-xs text-slate-500 leading-4">
                {draft.scheduleType === "WEEKLY"
                  ? "7-day continuous cycle mula sa napiling anchor date."
                  : draft.scheduleType === "MONTHLY"
                    ? "Buwanang cutoff base sa anchor day at katapusan ng buwan."
                    : draft.scheduleType === "MANUAL"
                      ? "Walang awtomatikong cycle; manu-manong kinukwenta."
                      : "Pumili muna ng schedule type sa itaas."}
              </p>
            </div>
          )}

          {/* Claim Opens After */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                Claim Opens After
              </label>
            </div>
            <div className="relative mt-2">
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="Positive whole number"
                disabled={!canManage || Boolean(busyAction)}
                value={draft.claimOpenAfterDays}
                onChange={(e) => onDraftChange("claimOpenAfterDays", e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 pr-28 text-xs font-bold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-rose-50 disabled:bg-slate-100"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                days after cutoff
              </span>
            </div>
          </div>

          {/* Claim Window */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                Claim Window
              </label>
            </div>
            <div className="relative mt-2">
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="Positive whole number"
                disabled={!canManage || Boolean(busyAction)}
                value={draft.claimWindowDays}
                onChange={(e) => onDraftChange("claimWindowDays", e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 pr-24 text-xs font-bold text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-rose-50 disabled:bg-slate-100"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                claimable days
              </span>
            </div>
          </div>
        </div>

        {/* Schedule Notes */}
        <div className="mt-4">
          <label className="block">
            <span className="text-xs font-bold text-slate-700">
              Schedule Version Notes (Opsyonal)
            </span>
            <input
              type="text"
              maxLength={1000}
              disabled={!canManage || Boolean(busyAction)}
              value={draft.notes}
              onChange={(e) => onDraftChange("notes", e.target.value)}
              placeholder="Hal. Setup para sa bagong cutoff window..."
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-rose-50 disabled:bg-slate-100"
            />
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-100">
        <button
          type="button"
          disabled={!canManage || Boolean(busyAction)}
          onClick={onPreview}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-60"
        >
          <Eye size={14} />
          {busyAction === "preview" ? "Calculating..." : "Preview 4 Periods"}
        </button>

        <button
          type="button"
          disabled={!canManage || Boolean(busyAction)}
          onClick={onSave}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-maroon)] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={14} />
          {!canManage
            ? "View Only"
            : busyAction === "save"
              ? "Saving New Version..."
              : "Save New Schedule Version"}
        </button>

        <button
          type="button"
          disabled={Boolean(busyAction)}
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      {/* Preview Periods Panel */}
      <PreviewPanel preview={preview} scheduleType={draft.scheduleType} />
    </div>
  )
}

export default function IncentiveProgramSchedulesSettingsV2({
  canManage = false,
}) {
  const [scope, setScope] = useState(null)
  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState("")
  const [draftsByBranch, setDraftsByBranch] = useState({})
  const [previewsByBranch, setPreviewsByBranch] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [busyKey, setBusyKey] = useState("")
  const [busyAction, setBusyAction] = useState("")
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const load = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const response = await getIncentiveProgramSchedules()
      const result = response?.data || null

      if (!result || !Array.isArray(result.branches)) {
        throw new Error("Invalid incentive program schedules response.")
      }

      setScope(result.scope || null)
      setBranches(result.branches)

      setSelectedBranchId((current) => {
        if (
          current &&
          result.branches.some((entry) => entry.branch.id === current)
        ) {
          return current
        }
        return result.branches[0]?.branch?.id || ""
      })

      const initialDrafts = Object.fromEntries(
        result.branches.map((entry) => [
          entry.branch.id,
          createBranchDrafts(entry),
        ]),
      )

      const initialPreviews = Object.fromEntries(
        result.branches.map((entry) => [
          entry.branch.id,
          createBranchPreviews(entry),
        ]),
      )

      setDraftsByBranch(initialDrafts)
      setPreviewsByBranch(initialPreviews)
    } catch (error) {
      setErrorMessage(
        apiMessage(error, "Unable to load incentive program schedules."),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedEntry = useMemo(
    () =>
      branches.find((entry) => entry.branch.id === selectedBranchId) || null,
    [branches, selectedBranchId],
  )

  const selectedDrafts = draftsByBranch[selectedBranchId] || {}
  const selectedPreviews = previewsByBranch[selectedBranchId] || {}

  const updateDraft = (programType, field, value) => {
    if (!selectedBranchId) return

    setDraftsByBranch((current) => ({
      ...current,
      [selectedBranchId]: {
        ...current[selectedBranchId],
        [programType]: {
          ...current[selectedBranchId]?.[programType],
          [field]: value,
        },
      },
    }))

    setMessage("")
    setErrorMessage("")
  }

  const resetProgram = (program) => {
    if (!selectedBranchId) return

    setDraftsByBranch((current) => ({
      ...current,
      [selectedBranchId]: {
        ...current[selectedBranchId],
        [program.programType]: createProgramDraft(program),
      },
    }))

    setMessage("")
    setErrorMessage("")
  }

  const handlePreview = async (program) => {
    if (!selectedEntry || !selectedBranchId) return

    const programType = program.programType
    const draft = selectedDrafts[programType]
    if (!draft) return

    const validation = validateAndBuildPayload({
      branchId: selectedBranchId,
      draft,
      includePreviewCount: true,
    })

    if (validation.error) {
      setErrorMessage(
        `${PROGRAM_LABELS[programType]}: ${validation.error}`,
      )
      return
    }

    const key = `${selectedBranchId}:${programType}`
    setBusyKey(key)
    setBusyAction("preview")
    setMessage("")
    setErrorMessage("")

    try {
      const response = await previewIncentiveProgramSchedule(
        programType,
        validation.payload,
      )

      const periods = response?.data?.preview || []
      const manualRequired = Boolean(response?.data?.manualRequired)

      setPreviewsByBranch((current) => ({
        ...current,
        [selectedBranchId]: {
          ...current[selectedBranchId],
          [programType]: { periods, manualRequired },
        },
      }))

      setMessage(
        `${selectedEntry.branch.code} ${PROGRAM_LABELS[programType]} periods calculated.`,
      )
    } catch (error) {
      setErrorMessage(
        apiMessage(
          error,
          `Unable to preview ${PROGRAM_LABELS[programType]} schedule.`,
        ),
      )
    } finally {
      setBusyKey("")
      setBusyAction("")
    }
  }

  const handleSave = async (program) => {
    if (!selectedEntry || !selectedBranchId) return

    const programType = program.programType
    const draft = selectedDrafts[programType]
    if (!draft) return

    const validation = validateAndBuildPayload({
      branchId: selectedBranchId,
      draft,
    })

    if (validation.error) {
      setErrorMessage(
        `${PROGRAM_LABELS[programType]}: ${validation.error}`,
      )
      return
    }

    const key = `${selectedBranchId}:${programType}`
    setBusyKey(key)
    setBusyAction("save")
    setMessage("")
    setErrorMessage("")

    try {
      const response = await createIncentiveProgramScheduleVersion(
        programType,
        validation.payload,
      )

      if (!response?.data?.scheduleVersion) {
        throw new Error("Unable to save schedule version.")
      }

      setMessage(
        `${selectedEntry.branch.code} ${PROGRAM_LABELS[programType]} saved successfully.`,
      )

      await load()
    } catch (error) {
      setErrorMessage(
        apiMessage(
          error,
          `Unable to save ${PROGRAM_LABELS[programType]} schedule.`,
        ),
      )
    } finally {
      setBusyKey("")
      setBusyAction("")
    }
  }

  const isGlobal = scope?.type === "GLOBAL"

  return (
    <div className="space-y-4">
      {/* Branch Selector Bar */}
      {isGlobal ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Building2 size={16} className="text-[var(--color-maroon)]" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              Select Branch:
            </span>
          </div>

          <div className="min-w-[240px]">
            <select
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-[var(--color-maroon)]"
              disabled={isLoading || Boolean(busyKey)}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              value={selectedBranchId}
            >
              {branches.map((branchEntry) => (
                <option
                  key={branchEntry.branch.id}
                  value={branchEntry.branch.id}
                >
                  {branchEntry.branch.code} — {branchEntry.branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {/* Notifications */}
      {message ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-800">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card">
          <p className="text-xs font-bold text-slate-500">
            Kinakarga ang program schedules...
          </p>
        </div>
      ) : null}

      {!isLoading && branches.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card">
          <p className="text-xs font-bold text-slate-500">
            Walang available na branch.
          </p>
        </div>
      ) : null}

      {!isLoading && selectedEntry ? (
        <div className="space-y-4">
          {PROGRAM_TYPES.map((programType) => {
            const program = getProgram(selectedEntry, programType)
            if (!program) return null

            const draft =
              selectedDrafts[programType] || createProgramDraft(program)
            const preview = selectedPreviews[programType]
            const key = `${selectedBranchId}:${programType}`

            return (
              <ScheduleCard
                branch={selectedEntry.branch}
                busyAction={busyKey === key ? busyAction : ""}
                canManage={canManage}
                draft={draft}
                key={programType}
                onDraftChange={(field, value) =>
                  updateDraft(programType, field, value)
                }
                onPreview={() => void handlePreview(program)}
                onReset={() => resetProgram(program)}
                onSave={() => void handleSave(program)}
                preview={preview}
                program={program}
              />
            )
          })}
        </div>
      ) : null}
    </div>
  )
}