import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import Badge from "../../components/ui/Badge"
import Card from "../../components/ui/Card"

import {
  createIncentiveProgramScheduleVersion,
  getIncentiveProgramSchedules,
  previewIncentiveProgramSchedule,
} from "./incentives.api"

const BUSINESS_TIME_ZONE =
  "Asia/Manila"

const PROGRAM_TYPES = [
  "ITEM_SALE",
  "ORDINARY_REPAIR",
  "BOARD_LEVEL_REPAIR",
]

const PROGRAM_LABELS = {
  ITEM_SALE:
    "Item Sale",
  ORDINARY_REPAIR:
    "Ordinary Repair",
  BOARD_LEVEL_REPAIR:
    "Board Level Repair",
}

const SCHEDULE_TYPES = [
  {
    value:
      "EVERY_N_DAYS",
    label:
      "Every N Days",
  },
  {
    value:
      "WEEKLY",
    label:
      "Weekly",
  },
  {
    value:
      "MONTHLY",
    label:
      "Monthly",
  },
  {
    value:
      "MANUAL",
    label:
      "Manual",
  },
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

function dateOnlyValue(
  value,
) {
  if (!value) {
    return ""
  }

  if (
    typeof value ===
    "string"
  ) {
    return value.slice(
      0,
      10,
    )
  }

  return ""
}

function getProgram(
  branchEntry,
  programType,
) {
  return (
    branchEntry
      ?.programs
      ?.find(
        (program) =>
          program
            .programType ===
          programType,
      ) ||
    null
  )
}

function createProgramDraft(
  program,
) {
  const configuration =
    program
      ?.configuration ||
    {}

  return {
    scheduleType:
      configuration
        .scheduleType ||
      "",

    anchorDate:
      dateOnlyValue(
        configuration
          .anchorDate,
      ),

    effectiveFrom:
      dateOnlyValue(
        configuration
          .effectiveFrom,
      ),

    everyNDays:
      configuration
        .everyNDays !==
        null &&
      configuration
        .everyNDays !==
        undefined
        ? String(
            configuration
              .everyNDays,
          )
        : "",

    claimOpenAfterDays:
      configuration
        .claimOpenAfterDays !==
        null &&
      configuration
        .claimOpenAfterDays !==
        undefined
        ? String(
            configuration
              .claimOpenAfterDays,
          )
        : "",

    claimWindowDays:
      configuration
        .claimWindowDays !==
        null &&
      configuration
        .claimWindowDays !==
        undefined
        ? String(
            configuration
              .claimWindowDays,
          )
        : "",

    notes:
      program
        ?.latestSavedVersion
        ?.notes ||
      "",
  }
}

function createBranchDrafts(
  branchEntry,
) {
  return Object.fromEntries(
    PROGRAM_TYPES.map(
      (programType) => [
        programType,
        createProgramDraft(
          getProgram(
            branchEntry,
            programType,
          ),
        ),
      ],
    ),
  )
}

function createBranchPreviews(
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
          {
            periods:
              Array.isArray(
                program
                  ?.configuration
                  ?.preview,
              )
                ? [
                    ...program
                      .configuration
                      .preview,
                  ]
                : [],

            manualRequired:
              Boolean(
                program
                  ?.configuration
                  ?.manualRequired,
              ),
          },
        ]
      },
    ),
  )
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

function positiveInteger(
  value,
) {
  const numeric =
    Number(value)

  if (
    !Number.isInteger(
      numeric,
    ) ||
    numeric < 1
  ) {
    return null
  }

  return numeric
}

function validateAndBuildPayload({
  branchId,
  draft,
  includePreviewCount = false,
}) {
  if (
    !branchId
  ) {
    return {
      error:
        "A branch is required.",
    }
  }

  if (
    !SCHEDULE_TYPES.some(
      (type) =>
        type.value ===
        draft.scheduleType,
    )
  ) {
    return {
      error:
        "Select a schedule type.",
    }
  }

  if (
    !draft.anchorDate
  ) {
    return {
      error:
        "Anchor Date is required.",
    }
  }

  if (
    !draft.effectiveFrom
  ) {
    return {
      error:
        "Effective From is required.",
    }
  }

  const claimOpenAfterDays =
    positiveInteger(
      draft
        .claimOpenAfterDays,
    )

  if (
    claimOpenAfterDays ===
    null
  ) {
    return {
      error:
        "Claim Opens After must be a positive whole number.",
    }
  }

  const claimWindowDays =
    positiveInteger(
      draft
        .claimWindowDays,
    )

  if (
    claimWindowDays ===
    null
  ) {
    return {
      error:
        "Claim Window must be a positive whole number.",
    }
  }

  let everyNDays =
    null

  if (
    draft.scheduleType ===
    "EVERY_N_DAYS"
  ) {
    everyNDays =
      positiveInteger(
        draft
          .everyNDays,
      )

    if (
      everyNDays ===
      null
    ) {
      return {
        error:
          "Every N Days must be a positive whole number.",
      }
    }
  }

  const payload = {
    branchId,

    scheduleType:
      draft.scheduleType,

    anchorDate:
      draft.anchorDate,

    effectiveFrom:
      draft.effectiveFrom,

    everyNDays,

    claimOpenAfterDays,

    claimWindowDays,

    notes:
      draft.notes
        .trim() ||
      null,
  }

  if (
    includePreviewCount
  ) {
    payload.count =
      4
  }

  return {
    payload,
  }
}

function PreviewPanel({
  preview,
  scheduleType,
}) {
  if (
    scheduleType ===
    "MANUAL" ||
    preview?.manualRequired
  ) {
    return (
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
        MANUAL has no automatic continuation or generated earning periods.
        The actual manual earning-period workflow will be connected later to
        the V2 incentive cycle engine.
      </div>
    )
  }

  const periods =
    Array.isArray(
      preview?.periods,
    )
      ? preview.periods
      : []

  if (
    !periods.length
  ) {
    return null
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--color-border)]">
      <table className="w-full min-w-[850px] text-left text-xs">
        <thead className="bg-[var(--color-soft)] text-[var(--color-muted)]">
          <tr>
            <th className="px-3 py-3">
              Period
            </th>

            <th className="px-3 py-3">
              Start
            </th>

            <th className="px-3 py-3">
              End
            </th>

            <th className="px-3 py-3">
              Cutoff
            </th>

            <th className="px-3 py-3">
              Claim Opens
            </th>

            <th className="px-3 py-3">
              Claim Closes
            </th>
          </tr>
        </thead>

        <tbody>
          {periods.map(
            (
              period,
              index,
            ) => (
              <tr
                className="border-t border-[var(--color-border)]"
                key={
                  period
                    .periodCode ||
                  `${period.startDate}-${index}`
                }
              >
                <td className="px-3 py-3 font-black text-[var(--color-text-strong)]">
                  {
                    period
                      .periodCode ||
                    "—"
                  }
                </td>

                <td className="px-3 py-3">
                  {
                    period
                      .startDate ||
                    "—"
                  }
                </td>

                <td className="px-3 py-3">
                  {
                    period
                      .endDate ||
                    "—"
                  }
                </td>

                <td className="px-3 py-3">
                  {
                    period
                      .cutoffDate ||
                    "—"
                  }
                </td>

                <td className="px-3 py-3">
                  {
                    period
                      .claimOpenDate ||
                    "—"
                  }
                </td>

                <td className="px-3 py-3">
                  {
                    period
                      .claimCloseDate ||
                    "—"
                  }
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
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
  const programType =
    program
      .programType

  const badge =
    stateBadge(
      program
        .configurationState,
    )

  const isEveryNDays =
    draft
      .scheduleType ===
    "EVERY_N_DAYS"

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
              }{" "}
              Schedule
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
            Independent schedule for this branch and incentive program.
          </p>

          <p className="mt-1 text-xs font-bold text-[var(--color-maroon)]">
            {
              branch.code
            }{" "}
            —{" "}
            {
              branch.name
            }
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-xl bg-[var(--color-soft)] px-3 py-2 text-xs font-bold text-[var(--color-muted)]">
            {
              BUSINESS_TIME_ZONE
            }
          </div>

          <div className="rounded-xl bg-[var(--color-soft)] px-3 py-2 text-xs font-bold text-[var(--color-muted)]">
            Append-only settings
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="text-sm font-black text-[var(--color-text-strong)]">
            Schedule Type
          </span>

          <select
            className="mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-bold outline-none focus:border-[var(--color-maroon)] disabled:bg-slate-100"
            disabled={
              !canManage ||
              Boolean(
                busyAction,
              )
            }
            onChange={(
              event,
            ) =>
              onDraftChange(
                "scheduleType",
                event
                  .target
                  .value,
              )
            }
            value={
              draft
                .scheduleType
            }
          >
            <option value="">
              Select schedule type
            </option>

            {SCHEDULE_TYPES.map(
              (type) => (
                <option
                  key={
                    type.value
                  }
                  value={
                    type.value
                  }
                >
                  {
                    type.label
                  }
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-black text-[var(--color-text-strong)]">
            Anchor Date
          </span>

          <input
            className="mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-bold outline-none focus:border-[var(--color-maroon)] disabled:bg-slate-100"
            disabled={
              !canManage ||
              Boolean(
                busyAction,
              )
            }
            onChange={(
              event,
            ) =>
              onDraftChange(
                "anchorDate",
                event
                  .target
                  .value,
              )
            }
            type="date"
            value={
              draft
                .anchorDate
            }
          />
        </label>

        <label className="block">
          <span className="text-sm font-black text-[var(--color-text-strong)]">
            Effective From
          </span>

          <input
            className="mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-bold outline-none focus:border-[var(--color-maroon)] disabled:bg-slate-100"
            disabled={
              !canManage ||
              Boolean(
                busyAction,
              )
            }
            onChange={(
              event,
            ) =>
              onDraftChange(
                "effectiveFrom",
                event
                  .target
                  .value,
              )
            }
            type="date"
            value={
              draft
                .effectiveFrom
            }
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {isEveryNDays ? (
          <label className="block">
            <span className="text-sm font-black text-[var(--color-text-strong)]">
              Every N Days
            </span>

            <input
              className="mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-bold outline-none focus:border-[var(--color-maroon)] disabled:bg-slate-100"
              disabled={
                !canManage ||
                Boolean(
                  busyAction,
                )
              }
              inputMode="numeric"
              min="1"
              onChange={(
                event,
              ) =>
                onDraftChange(
                  "everyNDays",
                  event
                    .target
                    .value,
                )
              }
              placeholder="Example: 14"
              step="1"
              type="number"
              value={
                draft
                  .everyNDays
              }
            />
          </label>
        ) : (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
            <p className="text-sm font-black text-[var(--color-text-strong)]">
              Cycle Interval
            </p>

            <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
              {draft.scheduleType === "WEEKLY"
                ? "Weekly uses a 7-day cycle from the selected anchor."
                : draft.scheduleType === "MONTHLY"
                  ? "Monthly follows the anchor day with month-end handling by the verified backend schedule engine."
                  : draft.scheduleType === "MANUAL"
                    ? "Manual has no automatic cycle continuation."
                    : "Select a schedule type first."}
            </p>
          </div>
        )}

        <label className="block">
          <span className="text-sm font-black text-[var(--color-text-strong)]">
            Claim Opens After
          </span>

          <span className="mt-1 block text-xs text-[var(--color-muted)]">
            Days after cutoff
          </span>

          <input
            className="mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-bold outline-none focus:border-[var(--color-maroon)] disabled:bg-slate-100"
            disabled={
              !canManage ||
              Boolean(
                busyAction,
              )
            }
            inputMode="numeric"
            min="1"
            onChange={(
              event,
            ) =>
              onDraftChange(
                "claimOpenAfterDays",
                event
                  .target
                  .value,
              )
            }
            placeholder="Positive whole number"
            step="1"
            type="number"
            value={
              draft
                .claimOpenAfterDays
            }
          />
        </label>

        <label className="block">
          <span className="text-sm font-black text-[var(--color-text-strong)]">
            Claim Window
          </span>

          <span className="mt-1 block text-xs text-[var(--color-muted)]">
            Number of claimable days
          </span>

          <input
            className="mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-bold outline-none focus:border-[var(--color-maroon)] disabled:bg-slate-100"
            disabled={
              !canManage ||
              Boolean(
                busyAction,
              )
            }
            inputMode="numeric"
            min="1"
            onChange={(
              event,
            ) =>
              onDraftChange(
                "claimWindowDays",
                event
                  .target
                  .value,
              )
            }
            placeholder="Positive whole number"
            step="1"
            type="number"
            value={
              draft
                .claimWindowDays
            }
          />
        </label>
      </div>

      <label className="mt-4 block rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
        <span className="font-bold text-[var(--color-text-strong)]">
          Schedule Notes
        </span>

        <span className="mt-1 block text-xs leading-5 text-[var(--color-muted)]">
          Optional note saved with this schedule version.
        </span>

        <input
          className="mt-3 h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:border-[var(--color-maroon)] disabled:bg-slate-100"
          disabled={
            !canManage ||
            Boolean(
              busyAction,
            )
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
          className="h-11 rounded-xl border border-[var(--color-border)] bg-white px-5 text-sm font-black text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            !canManage ||
            Boolean(
              busyAction,
            )
          }
          onClick={
            onPreview
          }
          type="button"
        >
          {busyAction ===
          "preview"
            ? "Calculating..."
            : "Preview 4 Periods"}
        </button>

        <button
          className="h-11 rounded-xl bg-[var(--color-maroon)] px-5 text-sm font-black text-white transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            !canManage ||
            Boolean(
              busyAction,
            )
          }
          onClick={
            onSave
          }
          type="button"
        >
          {!canManage
            ? "View Only"
            : busyAction ===
                "save"
              ? "Saving..."
              : "Save New Schedule Version"}
        </button>

        <button
          className="h-11 rounded-xl border border-[var(--color-border)] bg-white px-5 text-sm font-black text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:opacity-60"
          disabled={
            Boolean(
              busyAction,
            )
          }
          onClick={
            onReset
          }
          type="button"
        >
          Reset
        </button>
      </div>

      <PreviewPanel
        preview={
          preview
        }
        scheduleType={
          draft
            .scheduleType
        }
      />
    </Card>
  )
}

export default function IncentiveProgramSchedulesSettingsV2({
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

  const [
    previewsByBranch,
    setPreviewsByBranch,
  ] = useState({})

  const [isLoading, setIsLoading] =
    useState(true)

  const [busyKey, setBusyKey] =
    useState("")

  const [busyAction, setBusyAction] =
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
          await getIncentiveProgramSchedules()

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
            "Invalid incentive program schedules response.",
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

        setPreviewsByBranch(
          Object.fromEntries(
            result.branches.map(
              (
                branchEntry,
              ) => [
                branchEntry
                  .branch.id,

                createBranchPreviews(
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
                    .branch.id ===
                  current,
              )

            if (exists) {
              return current
            }

            return (
              result
                .branches[0]
                ?.branch.id ||
              ""
            )
          },
        )
      } catch (error) {
        setErrorMessage(
          apiMessage(
            error,
            "Unable to load incentive program schedules.",
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
        ) ||
        null,

      [
        branches,
        selectedBranchId,
      ],
    )

  const selectedDrafts =
    selectedBranchId
      ? draftsByBranch[
          selectedBranchId
        ] ||
        {}
      : {}

  const selectedPreviews =
    selectedBranchId
      ? previewsByBranch[
          selectedBranchId
        ] ||
        {}
      : {}

  const clearProgramPreview = (
    branchId,
    programType,
  ) => {
    setPreviewsByBranch(
      (current) => ({
        ...current,

        [branchId]: {
          ...current[
            branchId
          ],

          [programType]: {
            periods: [],
            manualRequired:
              false,
          },
        },
      }),
    )
  }

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

            ...(field ===
            "scheduleType"
              ? {
                  everyNDays:
                    value ===
                    "EVERY_N_DAYS"
                      ? current[
                          selectedBranchId
                        ]?.[
                          programType
                        ]?.everyNDays ||
                        ""
                      : "",
                }
              : {}),
          },
        },
      }),
    )

    clearProgramPreview(
      selectedBranchId,
      programType,
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

    const programType =
      program
        .programType

    setDraftsByBranch(
      (current) => ({
        ...current,

        [selectedBranchId]: {
          ...current[
            selectedBranchId
          ],

          [programType]:
            createProgramDraft(
              program,
            ),
        },
      }),
    )

    setPreviewsByBranch(
      (current) => ({
        ...current,

        [selectedBranchId]: {
          ...current[
            selectedBranchId
          ],

          [programType]: {
            periods:
              Array.isArray(
                program
                  ?.configuration
                  ?.preview,
              )
                ? [
                    ...program
                      .configuration
                      .preview,
                  ]
                : [],

            manualRequired:
              Boolean(
                program
                  ?.configuration
                  ?.manualRequired,
              ),
          },
        },
      }),
    )

    setMessage("")
    setErrorMessage("")
  }

  const previewProgram =
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
        program
          .programType

      const draft =
        selectedDrafts[
          programType
        ]

      if (!draft) {
        return
      }

      const built =
        validateAndBuildPayload({
          branchId:
            selectedBranchId,

          draft,

          includePreviewCount:
            true,
        })

      if (built.error) {
        setErrorMessage(
          `${
            PROGRAM_LABELS[
              programType
            ]
          }: ${built.error}`,
        )

        return
      }

      const key =
        `${selectedBranchId}:${programType}`

      setBusyKey(
        key,
      )

      setBusyAction(
        "preview",
      )

      setMessage("")
      setErrorMessage("")

      try {
        const response =
          await previewIncentiveProgramSchedule(
            programType,
            built.payload,
          )

        const result =
          response?.data

        if (
          !response?.success ||
          !result
        ) {
          throw new Error(
            "Unable to preview incentive program schedule.",
          )
        }

        setPreviewsByBranch(
          (current) => ({
            ...current,

            [selectedBranchId]: {
              ...current[
                selectedBranchId
              ],

              [programType]: {
                periods:
                  Array.isArray(
                    result.periods,
                  )
                    ? result.periods
                    : [],

                manualRequired:
                  Boolean(
                    result
                      .manualRequired,
                  ),
              },
            },
          }),
        )

        setMessage(
          result
            .manualRequired
            ? `${
                selectedEntry
                  .branch.code
              } ${
                PROGRAM_LABELS[
                  programType
                ]
              }: MANUAL requires explicit earning periods and has no automatic continuation.`
            : `${
                selectedEntry
                  .branch.code
              } ${
                PROGRAM_LABELS[
                  programType
                ]
              } preview calculated successfully.`,
        )
      } catch (error) {
        setErrorMessage(
          apiMessage(
            error,
            `Unable to preview ${
              PROGRAM_LABELS[
                programType
              ]
            } schedule.`,
          ),
        )
      } finally {
        setBusyKey(
          "",
        )

        setBusyAction(
          "",
        )
      }
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
        program
          .programType

      const draft =
        selectedDrafts[
          programType
        ]

      if (!draft) {
        return
      }

      const built =
        validateAndBuildPayload({
          branchId:
            selectedBranchId,

          draft,

          includePreviewCount:
            false,
        })

      if (built.error) {
        setErrorMessage(
          `${
            PROGRAM_LABELS[
              programType
            ]
          }: ${built.error}`,
        )

        return
      }

      const key =
        `${selectedBranchId}:${programType}`

      setBusyKey(
        key,
      )

      setBusyAction(
        "save",
      )

      setMessage("")
      setErrorMessage("")

      try {
        const response =
          await createIncentiveProgramScheduleVersion(
            programType,
            built.payload,
          )

        if (
          !response?.success ||
          !response?.data
        ) {
          throw new Error(
            "Unable to save incentive program schedule.",
          )
        }

        setMessage(
          `${
            selectedEntry
              .branch.code
          } ${
            PROGRAM_LABELS[
              programType
            ]
          } schedule version saved successfully.`,
        )

        await load()
      } catch (error) {
        setErrorMessage(
          apiMessage(
            error,
            `Unable to save ${
              PROGRAM_LABELS[
                programType
              ]
            } schedule.`,
          ),
        )
      } finally {
        setBusyKey(
          "",
        )

        setBusyAction(
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
              Independent Program Schedules
            </Badge>

            <h3 className="mt-3 text-xl font-black text-[var(--color-text-strong)]">
              Incentive Schedule Configuration
            </h3>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--color-muted)]">
              Item Sale, Ordinary Repair, and Board Level Repair have independent per-branch schedules.
            </p>
          </div>

          <div className="min-w-64">
            {isGlobal ? (
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-muted)]">
                  Branch
                </span>

                <select
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm font-bold outline-none focus:border-[var(--color-maroon)] disabled:bg-slate-100"
                  disabled={
                    isLoading ||
                    Boolean(
                      busyKey,
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
                            .branch.id
                        }
                        value={
                          branchEntry
                            .branch.id
                        }
                      >
                        {
                          branchEntry
                            .branch.code
                        }{" "}
                        —{" "}
                        {
                          branchEntry
                            .branch.name
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

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm leading-6 text-[var(--color-muted)]">
            Business calendar and schedule dates use{" "}
            <strong>
              {
                BUSINESS_TIME_ZONE
              }
            </strong>
            .
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm leading-6 text-[var(--color-muted)]">
            Each successful save creates a new append-only schedule version for the selected branch and program.
          </div>
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
            Loading independent program schedules...
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

              const preview =
                selectedPreviews[
                  programType
                ] || {
                  periods: [],
                  manualRequired:
                    false,
                }

              const key =
                `${selectedBranchId}:${programType}`

              return (
                <ScheduleCard
                  branch={
                    selectedEntry
                      .branch
                  }
                  busyAction={
                    busyKey ===
                    key
                      ? busyAction
                      : ""
                  }
                  canManage={
                    canManage
                  }
                  draft={
                    draft
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
                  onPreview={() =>
                    void previewProgram(
                      program,
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
                  preview={
                    preview
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