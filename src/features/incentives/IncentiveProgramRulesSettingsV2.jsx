import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import Badge from "../../components/ui/Badge"
import Card from "../../components/ui/Card"

import {
  createIncentiveProgramRuleVersion,
  getIncentiveProgramRules,
} from "./incentives.api"

const PROGRAM_TYPES = [
  "ITEM_SALE",
  "ORDINARY_REPAIR",
  "BOARD_LEVEL_REPAIR",
]

const PROGRAM_LABELS = {
  ITEM_SALE: "Item Sale",
  ORDINARY_REPAIR: "Ordinary Repair",
  BOARD_LEVEL_REPAIR: "Board Level Repair",
}

const PRICE_TIERS = [
  1,
  2,
  3,
  4,
  5,
]

function apiMessage(
  error,
  fallback,
) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

function getProgram(
  branchEntry,
  programType,
) {
  return (
    branchEntry?.programs?.find(
      (program) =>
        program.programType ===
        programType,
    ) || null
  )
}

function createProgramDraft(
  program,
) {
  const configuration =
    program?.configuration || {}

  const isItem =
    program?.programType ===
    "ITEM_SALE"

  return {
    eligiblePriceTiers:
      isItem &&
      Array.isArray(
        configuration
          .eligiblePriceTiers,
      )
        ? [
            ...configuration
              .eligiblePriceTiers,
          ]
        : [],

    repairCostPercent:
      !isItem &&
      configuration
        .repairCostPercent !==
        null &&
      configuration
        .repairCostPercent !==
        undefined
        ? String(
            configuration
              .repairCostPercent,
          )
        : "",

    notes:
      program
        ?.latestSavedVersion
        ?.notes || "",
  }
}

function createBranchDrafts(
  branchEntry,
) {
  return Object.fromEntries(
    PROGRAM_TYPES.map(
      (programType) => {
        const program =
          getProgram(
            branchEntry,
            programType,
          )

        return [
          programType,
          createProgramDraft(
            program,
          ),
        ]
      },
    ),
  )
}

function derivedCompanyShare(
  rawRepairCost,
) {
  if (
    rawRepairCost === "" ||
    rawRepairCost === null ||
    rawRepairCost ===
      undefined
  ) {
    return null
  }

  const repairCost =
    Number(rawRepairCost)

  if (
    !Number.isFinite(
      repairCost,
    ) ||
    repairCost < 0 ||
    repairCost > 100
  ) {
    return null
  }

  return Number(
    (
      100 -
      repairCost
    ).toFixed(4),
  )
}

function percentLabel(
  value,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—"
  }

  const numeric =
    Number(value)

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return "—"
  }

  return `${numeric.toLocaleString(
    undefined,
    {
      maximumFractionDigits: 4,
    },
  )}%`
}

function stateBadge(
  state,
) {
  if (
    state ===
    "CONFIGURED"
  ) {
    return {
      label:
        "Configured",

      tone:
        "green",
    }
  }

  return {
    label:
      "Not Configured",

    tone:
      "gray",
  }
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
  const programType =
    program.programType

  const isItem =
    programType ===
    "ITEM_SALE"

  const badge =
    stateBadge(
      program.configurationState,
    )

  const companyShare =
    isItem
      ? null
      : derivedCompanyShare(
          draft
            .repairCostPercent,
        )

  const toggleTier = (
    tier,
  ) => {
    const current =
      Array.isArray(
        draft
          .eligiblePriceTiers,
      )
        ? draft
            .eligiblePriceTiers
        : []

    const next =
      current.includes(tier)
        ? current.filter(
            (value) =>
              value !== tier,
          )
        : [
            ...current,
            tier,
          ].sort(
            (a, b) =>
              a - b,
          )

    onDraftChange(
      "eligiblePriceTiers",
      next,
    )
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-black text-[var(--color-text-strong)]">
              {
                PROGRAM_LABELS[
                  programType
                ]
              }
            </h4>

            <Badge
              tone={
                badge.tone
              }
            >
              {
                badge.label
              }
            </Badge>
          </div>

          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            {isItem
              ? "Choose which transaction Price Tiers contribute to the branch-wide eligible Item Sale basis."
              : "Configure the repair financial split for this branch and repair category."}
          </p>

          <p className="mt-1 text-xs font-bold text-[var(--color-maroon)]">
            {branch.code} —{" "}
            {branch.name}
          </p>
        </div>

        <div className="rounded-xl bg-[var(--color-soft)] px-3 py-2 text-xs font-bold text-[var(--color-muted)]">
          Append-only settings
        </div>
      </div>

      {isItem ? (
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Eligible Price Tiers
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-5">
            {PRICE_TIERS.map(
              (tier) => {
                const checked =
                  draft
                    .eligiblePriceTiers
                    .includes(
                      tier,
                    )

                return (
                  <label
                    className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
                      checked
                        ? "border-[var(--color-maroon)] bg-[var(--color-maroon-soft)]"
                        : "border-[var(--color-border)] bg-[var(--color-soft)]"
                    } ${
                      !canManage ||
                      isSaving
                        ? "cursor-not-allowed opacity-70"
                        : ""
                    }`}
                    key={
                      tier
                    }
                  >
                    <input
                      checked={
                        checked
                      }
                      disabled={
                        !canManage ||
                        isSaving
                      }
                      onChange={() =>
                        toggleTier(
                          tier,
                        )
                      }
                      type="checkbox"
                    />

                    <span className="font-black text-[var(--color-text-strong)]">
                      Price {tier}
                    </span>
                  </label>
                )
              },
            )}
          </div>

          <p className="mt-3 text-xs leading-5 text-[var(--color-muted)]">
            Leaving all tiers unchecked means no Price Tier is currently eligible for the branch Item Sale incentive basis.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
            <span className="font-bold text-[var(--color-text-strong)]">
              Repair Cost Pool %
            </span>

            <span className="mt-1 block text-xs leading-5 text-[var(--color-muted)]">
              Percentage of the base/cash repair price assigned to the Repair Cost Pool.
            </span>

            <input
              className="mt-3 h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 text-sm font-bold outline-none focus:border-[var(--color-maroon)] disabled:bg-[var(--color-soft)] disabled:text-[var(--color-muted)]"
              disabled={
                !canManage ||
                isSaving
              }
              inputMode="decimal"
              max="100"
              min="0"
              onChange={(
                event,
              ) =>
                onDraftChange(
                  "repairCostPercent",
                  event
                    .target
                    .value,
                )
              }
              placeholder="Example: 65"
              step="0.0001"
              type="number"
              value={
                draft
                  .repairCostPercent
              }
            />
          </label>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
            <p className="font-bold text-[var(--color-text-strong)]">
              Company Share %
            </p>

            <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
              Automatically derived as 100% minus Repair Cost Pool %. This value is not edited or stored separately.
            </p>

            <div className="mt-3 flex h-11 items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm font-black text-[var(--color-text-strong)]">
              {
                percentLabel(
                  companyShare,
                )
              }
            </div>
          </div>
        </div>
      )}

      <label className="mt-4 block rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
        <span className="font-bold text-[var(--color-text-strong)]">
          Rule Notes
        </span>

        <span className="mt-1 block text-xs leading-5 text-[var(--color-muted)]">
          Optional note saved together with this rule version.
        </span>

        <input
          className="mt-3 h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 text-sm outline-none focus:border-[var(--color-maroon)] disabled:bg-[var(--color-soft)] disabled:text-[var(--color-muted)]"
          disabled={
            !canManage ||
            isSaving
          }
          maxLength={
            1000
          }
          onChange={(
            event,
          ) =>
            onDraftChange(
              "notes",
              event
                .target
                .value,
            )
          }
          placeholder="Optional"
          type="text"
          value={
            draft.notes
          }
        />
      </label>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          className="h-11 rounded-xl bg-[var(--color-maroon)] px-5 text-sm font-black text-white transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            !canManage ||
            isSaving
          }
          onClick={
            onSave
          }
          type="button"
        >
          {!canManage
            ? "View Only"
            : isSaving
              ? "Saving..."
              : "Save New Rule Version"}
        </button>

        <button
          className="h-11 rounded-xl border border-[var(--color-border)] bg-white px-5 text-sm font-black text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:opacity-60"
          disabled={
            isSaving
          }
          onClick={
            onReset
          }
          type="button"
        >
          Reset
        </button>
      </div>
    </Card>
  )
}

export default function IncentiveProgramRulesSettingsV2({
  canManage = false,
}) {
  const [scope, setScope] =
    useState(null)

  const [branches, setBranches] =
    useState([])

  const [
    selectedBranchId,
    setSelectedBranchId,
  ] = useState("")

  const [
    draftsByBranch,
    setDraftsByBranch,
  ] = useState({})

  const [isLoading, setIsLoading] =
    useState(true)

  const [savingKey, setSavingKey] =
    useState("")

  const [message, setMessage] =
    useState("")

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("")

  const load =
    useCallback(async () => {
      setIsLoading(true)
      setErrorMessage("")

      try {
        const response =
          await getIncentiveProgramRules()

        const result =
          response?.data ||
          null

        if (
          !result ||
          !Array.isArray(
            result.branches,
          )
        ) {
          throw new Error(
            "Invalid incentive program rules response.",
          )
        }

        setScope(
          result.scope ||
            null,
        )

        setBranches(
          result.branches,
        )

        setDraftsByBranch(
          Object.fromEntries(
            result.branches.map(
              (
                branchEntry,
              ) => [
                branchEntry
                  .branch.id,

                createBranchDrafts(
                  branchEntry,
                ),
              ],
            ),
          ),
        )

        setSelectedBranchId(
          (current) => {
            const exists =
              result.branches.some(
                (
                  branchEntry,
                ) =>
                  branchEntry
                    .branch
                    .id ===
                  current,
              )

            if (
              exists
            ) {
              return current
            }

            return (
              result
                .branches[0]
                ?.branch
                ?.id || ""
            )
          },
        )
      } catch (error) {
        setErrorMessage(
          apiMessage(
            error,
            "Unable to load incentive program rules.",
          ),
        )
      } finally {
        setIsLoading(
          false,
        )
      }
    }, [])

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void load()
        },
        0,
      )

    return () =>
      window.clearTimeout(
        timer,
      )
  }, [load])

  const selectedEntry =
    useMemo(
      () =>
        branches.find(
          (
            branchEntry,
          ) =>
            branchEntry
              .branch.id ===
            selectedBranchId,
        ) || null,

      [
        branches,
        selectedBranchId,
      ],
    )

  const selectedDrafts =
    selectedBranchId
      ? draftsByBranch[
          selectedBranchId
        ] || {}
      : {}

  const updateDraft = (
    programType,
    field,
    value,
  ) => {
    if (
      !selectedBranchId
    ) {
      return
    }

    setDraftsByBranch(
      (current) => ({
        ...current,

        [selectedBranchId]: {
          ...current[
            selectedBranchId
          ],

          [programType]: {
            ...current[
              selectedBranchId
            ]?.[
              programType
            ],

            [field]:
              value,
          },
        },
      }),
    )

    setMessage("")
    setErrorMessage("")
  }

  const resetProgram = (
    program,
  ) => {
    if (
      !selectedBranchId
    ) {
      return
    }

    setDraftsByBranch(
      (current) => ({
        ...current,

        [selectedBranchId]: {
          ...current[
            selectedBranchId
          ],

          [program
            .programType]:
            createProgramDraft(
              program,
            ),
        },
      }),
    )

    setMessage("")
    setErrorMessage("")
  }

  const saveProgram =
    async (
      program,
    ) => {
      if (
        !selectedEntry ||
        !selectedBranchId
      ) {
        return
      }

      const programType =
        program.programType

      const draft =
        selectedDrafts[
          programType
        ]

      if (!draft) {
        return
      }

      setMessage("")
      setErrorMessage("")

      const isItem =
        programType ===
        "ITEM_SALE"

      let repairCostPercent =
        null

      if (!isItem) {
        if (
          draft
            .repairCostPercent ===
            ""
        ) {
          setErrorMessage(
            `${PROGRAM_LABELS[programType]}: Repair Cost Pool % is required.`,
          )

          return
        }

        repairCostPercent =
          Number(
            draft
              .repairCostPercent,
          )

        if (
          !Number.isFinite(
            repairCostPercent,
          ) ||
          repairCostPercent <
            0 ||
          repairCostPercent >
            100
        ) {
          setErrorMessage(
            `${PROGRAM_LABELS[programType]}: Repair Cost Pool % must be between 0 and 100.`,
          )

          return
        }
      }

      const tiers =
        isItem
          ? [
              ...new Set(
                draft
                  .eligiblePriceTiers
                  .map(
                    Number,
                  ),
              ),
            ]
              .filter(
                (tier) =>
                  Number.isInteger(
                    tier,
                  ) &&
                  tier >=
                    1 &&
                  tier <=
                    5,
              )
              .sort(
                (a, b) =>
                  a - b,
              )
          : []

      const payload = {
        branchId:
          selectedBranchId,

        eligiblePriceTiers:
          tiers,

        repairCostPercent:
          isItem
            ? null
            : repairCostPercent,

        notes:
          draft
            .notes
            .trim() ||
          null,
      }

      const key =
        `${selectedBranchId}:${programType}`

      setSavingKey(
        key,
      )

      try {
        const response =
          await createIncentiveProgramRuleVersion(
            programType,
            payload,
          )

        if (
          !response
            ?.success ||
          !response
            ?.data
        ) {
          throw new Error(
            "Unable to save incentive program rule.",
          )
        }

        setMessage(
          `${selectedEntry.branch.code} ${PROGRAM_LABELS[programType]} rule saved successfully.`,
        )

        await load()
      } catch (error) {
        setErrorMessage(
          apiMessage(
            error,
            `Unable to save ${PROGRAM_LABELS[programType]} rule.`,
          ),
        )
      } finally {
        setSavingKey(
          "",
        )
      }
    }

  const isGlobal =
    scope?.type ===
    "GLOBAL"

  return (
    <div className="space-y-4">
      <Card className="border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon-soft)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Badge tone="maroon">
              Branch Program Rules
            </Badge>

            <h3 className="mt-3 text-xl font-black text-[var(--color-text-strong)]">
              Incentive Program Configuration
            </h3>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--color-muted)]">
              Configure Item Sale eligibility and repair financial rules independently for each branch.
            </p>
          </div>

          <div className="min-w-64">
            {isGlobal ? (
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-muted)]">
                  Branch
                </span>

                <select
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 text-sm font-bold outline-none focus:border-[var(--color-maroon)] disabled:bg-[var(--color-soft)] disabled:text-[var(--color-muted)]"
                  disabled={
                    isLoading ||
                    Boolean(
                      savingKey,
                    )
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedBranchId(
                      event
                        .target
                        .value,
                    )
                  }
                  value={
                    selectedBranchId
                  }
                >
                  {branches.map(
                    (
                      branchEntry,
                    ) => (
                      <option
                        key={
                          branchEntry
                            .branch
                            .id
                        }
                        value={
                          branchEntry
                            .branch
                            .id
                        }
                      >
                        {
                          branchEntry
                            .branch
                            .code
                        }{" "}
                        —{" "}
                        {
                          branchEntry
                            .branch
                            .name
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>
            ) : (
              <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-muted)]">
                  Branch Scope
                </p>

                <p className="mt-1 text-sm font-black text-[var(--color-text-strong)]">
                  Assigned branch only
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm leading-6 text-[var(--color-muted)]">
          Each save creates a new settings version. Item Sale uses only selected Price Tiers. Repair programs store only Repair Cost Pool %, while Company Share is derived automatically.
        </div>
      </Card>

      {message ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {
            errorMessage
          }
        </div>
      ) : null}

      {isLoading ? (
        <Card>
          <p className="text-sm font-bold text-[var(--color-muted)]">
            Loading branch program rules...
          </p>
        </Card>
      ) : null}

      {!isLoading &&
      branches.length ===
        0 ? (
        <Card>
          <p className="font-bold text-[var(--color-text-strong)]">
            No active branch is available.
          </p>
        </Card>
      ) : null}

      {!isLoading &&
      selectedEntry ? (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-maroon)]">
              Selected Branch
            </p>

            <h3 className="mt-1 text-lg font-black text-[var(--color-text-strong)]">
              {
                selectedEntry
                  .branch.code
              }{" "}
              —{" "}
              {
                selectedEntry
                  .branch.name
              }
            </h3>
          </div>

          {PROGRAM_TYPES.map(
            (
              programType,
            ) => {
              const program =
                getProgram(
                  selectedEntry,
                  programType,
                )

              if (!program) {
                return null
              }

              const draft =
                selectedDrafts[
                  programType
                ] ||
                createProgramDraft(
                  program,
                )

              const key =
                `${selectedBranchId}:${programType}`

              return (
                <ProgramCard
                  branch={
                    selectedEntry
                      .branch
                  }
                  canManage={
                    canManage
                  }
                  draft={
                    draft
                  }
                  isSaving={
                    savingKey ===
                    key
                  }
                  key={
                    programType
                  }
                  onDraftChange={(
                    field,
                    value,
                  ) =>
                    updateDraft(
                      programType,
                      field,
                      value,
                    )
                  }
                  onReset={() =>
                    resetProgram(
                      program,
                    )
                  }
                  onSave={() =>
                    void saveProgram(
                      program,
                    )
                  }
                  program={
                    program
                  }
                />
              )
            },
          )}
        </section>
      ) : null}
    </div>
  )
}