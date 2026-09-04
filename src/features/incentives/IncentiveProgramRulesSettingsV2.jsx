import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Building2,
  CheckCircle2,
  Clock,
  Cpu,
  Lock,
  RotateCcw,
  Save,
  ShoppingBag,
  Sliders,
  Wrench,
  Check,
  AlertCircle,
} from "lucide-react"

import {
  createIncentiveProgramRuleVersion,
  getIncentiveProgramRules,
} from "./incentives.api"

const PROGRAM_TYPES = ["ITEM_SALE", "ORDINARY_REPAIR", "BOARD_LEVEL_REPAIR"]

const PROGRAM_LABELS = {
  ITEM_SALE: "Item Sale Program",
  ORDINARY_REPAIR: "Ordinary Repair Program",
  BOARD_LEVEL_REPAIR: "Board Level Repair Program",
}

const PROGRAM_ICONS = {
  ITEM_SALE: ShoppingBag,
  ORDINARY_REPAIR: Wrench,
  BOARD_LEVEL_REPAIR: Cpu,
}

const PROGRAM_DESCRIPTIONS = {
  ITEM_SALE: "Piliin kung aling transaction Price Tiers ang eligible para sa branch-wide Item Sale incentive pool.",
  ORDINARY_REPAIR: "Itakda ang Repair Cost Pool % (labor pool) para sa regular repairs; ang matitira ay Company Share.",
  BOARD_LEVEL_REPAIR: "Itakda ang Repair Cost Pool % para sa micro-soldering at chip repair; ang matitira ay Company Share.",
}

const PRICE_TIERS = [1, 2, 3, 4, 5]

function apiMessage(error, fallback) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
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
  const isItem = program?.programType === "ITEM_SALE"

  return {
    eligiblePriceTiers:
      isItem && Array.isArray(configuration.eligiblePriceTiers)
        ? [...configuration.eligiblePriceTiers]
        : [],
    repairCostPercent:
      !isItem &&
      configuration.repairCostPercent !== null &&
      configuration.repairCostPercent !== undefined
        ? String(configuration.repairCostPercent)
        : "",
    notes: program?.latestSavedVersion?.notes || "",
  }
}

function createBranchDrafts(branchEntry) {
  return Object.fromEntries(
    PROGRAM_TYPES.map((programType) => {
      const program = getProgram(branchEntry, programType)
      return [programType, createProgramDraft(program)]
    }),
  )
}

function derivedCompanyShare(rawRepairCost) {
  if (
    rawRepairCost === "" ||
    rawRepairCost === null ||
    rawRepairCost === undefined
  ) {
    return null
  }

  const repairCost = Number(rawRepairCost)
  if (!Number.isFinite(repairCost) || repairCost < 0 || repairCost > 100) {
    return null
  }

  return Number((100 - repairCost).toFixed(4))
}

function percentLabel(value) {
  if (value === null || value === undefined || value === "") {
    return "—"
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return "—"
  }

  return `${numeric.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })}%`
}

function ProgramCard({
  branch,
  program,
  draft,
  canManage,
  isSaving,
  onDraftChange,
  onReset,
  onSave,
}) {
  const programType = program.programType
  const isItem = programType === "ITEM_SALE"
  const isConfigured = program.configurationState === "CONFIGURED"
  const Icon = PROGRAM_ICONS[programType] || Sliders
  const companyShare = isItem
    ? null
    : derivedCompanyShare(draft.repairCostPercent)

  const toggleTier = (tier) => {
    const current = Array.isArray(draft.eligiblePriceTiers)
      ? draft.eligiblePriceTiers
      : []

    const next = current.includes(tier)
      ? current.filter((value) => value !== tier)
      : [...current, tier].sort((a, b) => a - b)

    onDraftChange("eligiblePriceTiers", next)
  }

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
              {PROGRAM_DESCRIPTIONS[programType]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 px-2.5 py-1 text-[11px] font-bold text-slate-500">
            <Lock size={11} className="text-slate-400" />
            Append-only versioned
          </span>
        </div>
      </div>

      {/* Main Form Body */}
      {isItem ? (
        <div className="mt-5 pt-5 border-t border-slate-100">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                Eligible Price Tiers
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Piliin ang mga tier na bibilangin sa sales pool basis ng branch (e.g. Price 1–3).
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {draft.eligiblePriceTiers.length} of 5 selected
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {PRICE_TIERS.map((tier) => {
              const checked = draft.eligiblePriceTiers.includes(tier)

              return (
                <button
                  key={tier}
                  type="button"
                  disabled={!canManage || isSaving}
                  onClick={() => toggleTier(tier)}
                  className={`flex items-center justify-between rounded-2xl border p-3.5 transition-all text-left ${
                    checked
                      ? "border-[var(--color-maroon)] bg-rose-50/50 shadow-2xs ring-1 ring-[var(--color-maroon)]/30 text-[var(--color-maroon)]"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                  } ${!canManage || isSaving ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                >
                  <div>
                    <p className="text-xs font-black">Price {tier}</p>
                    <p className="text-[10px] text-slate-500 font-medium">Tier {tier}</p>
                  </div>

                  <div
                    className={`grid size-5 place-items-center rounded-lg border transition ${
                      checked
                        ? "border-[var(--color-maroon)] bg-[var(--color-maroon)] text-white"
                        : "border-slate-300 bg-white text-transparent"
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
                  </div>
                </button>
              )
            })}
          </div>

          {draft.eligiblePriceTiers.length === 0 ? (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2">
              ⚠️ Walang price tier na naka-check: walang maco-compute na Item Sale incentive basis para sa branch na ito.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 pt-5 border-t border-slate-100 grid gap-4 sm:grid-cols-2">
          {/* Repair Cost Pool % */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Repair Cost Pool %
              </label>
              <span className="rounded-full bg-blue-50 border border-blue-200/80 px-2 py-0.5 text-[10px] font-black text-blue-700">
                Staff Pool
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Porsyento ng service charge na inilalaan sa technician / staff incentive pool.
            </p>

            <div className="relative mt-3">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                inputMode="decimal"
                disabled={!canManage || isSaving}
                value={draft.repairCostPercent}
                onChange={(e) => onDraftChange("repairCostPercent", e.target.value)}
                placeholder="Hal. 65.0"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-8 text-sm font-black text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-rose-50"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                %
              </span>
            </div>
          </div>

          {/* Company Share % */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                Company Share %
              </p>
              <span className="rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                Retained
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Awtomatikong kinaltas (100% - Repair Cost Pool %). Ito ang mananatili sa kumpanya.
            </p>

            <div className="mt-3 flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5">
              <span className="text-xs font-bold text-slate-500">Kikitain ng Store:</span>
              <span className="text-sm font-black text-emerald-700">
                {percentLabel(companyShare)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Rule Notes */}
      <div className="mt-4">
        <label className="block">
          <span className="text-xs font-bold text-slate-700">
            Rule Version Notes (Opsyonal)
          </span>
          <input
            type="text"
            maxLength={1000}
            disabled={!canManage || isSaving}
            value={draft.notes}
            onChange={(e) => onDraftChange("notes", e.target.value)}
            placeholder="Hal. Updated price tiers para sa Q4 promo..."
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[var(--color-maroon)] focus:ring-2 focus:ring-rose-50 disabled:bg-slate-100"
          />
        </label>
      </div>

      {/* Action Buttons */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-100">
        <button
          type="button"
          disabled={!canManage || isSaving}
          onClick={onSave}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-maroon)] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={14} />
          {!canManage
            ? "View Only"
            : isSaving
              ? "Saving New Version..."
              : "Save New Rule Version"}
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>
    </div>
  )
}

export default function IncentiveProgramRulesSettingsV2({
  canManage = false,
}) {
  const [scope, setScope] = useState(null)
  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState("")
  const [draftsByBranch, setDraftsByBranch] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [savingKey, setSavingKey] = useState("")
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const load = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const response = await getIncentiveProgramRules()
      const result = response?.data || null

      if (!result || !Array.isArray(result.branches)) {
        throw new Error("Invalid incentive program rules response.")
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

      setDraftsByBranch(initialDrafts)
    } catch (error) {
      setErrorMessage(
        apiMessage(error, "Unable to load incentive program rules."),
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
    })),

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

  const saveProgram = async (program) => {
    if (!selectedEntry || !selectedBranchId) return

    const programType = program.programType
    const draft = selectedDrafts[programType]

    if (!draft) return

    const isItem = programType === "ITEM_SALE"
    let repairCostPercent = null

    if (!isItem) {
      if (draft.repairCostPercent === "") {
        setErrorMessage(
          `${PROGRAM_LABELS[programType]}: Please enter a Repair Cost Pool %.`,
        )
        return
      }

      repairCostPercent = Number(draft.repairCostPercent)

      if (
        !Number.isFinite(repairCostPercent) ||
        repairCostPercent < 0 ||
        repairCostPercent > 100
      ) {
        setErrorMessage(
          `${PROGRAM_LABELS[programType]}: Repair Cost Pool % must be between 0 and 100.`,
        )
        return
      }
    }

    const tiers = isItem
      ? [...new Set(draft.eligiblePriceTiers.map(Number))]
          .filter((tier) => Number.isInteger(tier) && tier >= 1 && tier <= 5)
          .sort((a, b) => a - b)
      : []

    const payload = {
      branchId: selectedBranchId,
      eligiblePriceTiers: tiers,
      repairCostPercent: isItem ? null : repairCostPercent,
      notes: draft.notes.trim() || null,
    }

    const key = `${selectedBranchId}:${programType}`
    setSavingKey(key)
    setMessage("")
    setErrorMessage("")

    try {
      const response = await createIncentiveProgramRuleVersion(
        programType,
        payload,
      )

      if (!response?.data?.ruleVersion) {
        throw new Error("Unable to save incentive program rule.")
      }

      setMessage(
        `${selectedEntry.branch.code} ${PROGRAM_LABELS[programType]} rule saved successfully.`,
      )

      await load()
    } catch (error) {
      setErrorMessage(
        apiMessage(error, `Unable to save ${PROGRAM_LABELS[programType]} rule.`),
      )
    } finally {
      setSavingKey("")
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
              disabled={isLoading || Boolean(savingKey)}
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
            Kinakarga ang program rules...
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
            const key = `${selectedBranchId}:${programType}`

            return (
              <ProgramCard
                branch={selectedEntry.branch}
                canManage={canManage}
                draft={draft}
                isSaving={savingKey === key}
                key={programType}
                onDraftChange={(field, value) =>
                  updateDraft(programType, field, value)
                }
                onReset={() => resetProgram(program)}
                onSave={() => void saveProgram(program)}
                program={program}
              />
            )
          })}
        </div>
      ) : null}
    </div>
  )
}