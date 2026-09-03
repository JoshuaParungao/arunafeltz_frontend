import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import Badge from "../../components/ui/Badge"
import Card from "../../components/ui/Card"
import {
  createIncentiveAccountConfigurationVersion,
  getIncentiveAccountConfigurations,
} from "./incentives.api"

const CLASSIFICATION_LABELS = {
  SALES_AGENT: "Sales Agent",
  SENIOR_SALES_AGENT: "Senior Sales Agent",
  TECHNICIAN: "Technician",
  SENIOR_TECHNICIAN: "Senior Technician",
}

function apiMessage(error, fallback) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

function accountTypeLabel(account) {
  return (
    CLASSIFICATION_LABELS[
      account?.effectiveIncentiveClassification
    ] ||
    String(
      account?.effectiveIncentiveClassification ||
        account?.role ||
        "Staff",
    ).replaceAll("_", " ")
  )
}

function accountDraft(account) {
  const configuration =
    account?.configuration || {}

  return {
    itemEnabled:
      Boolean(configuration?.item?.enabled),

    itemRatePercent:
      configuration?.item?.ratePercent ??
      "",

    ordinaryRepairEnabled:
      Boolean(
        configuration?.ordinaryRepair?.enabled,
      ),

    ordinaryRepairRatePercent:
      configuration?.ordinaryRepair
        ?.ratePercent ?? "",

    boardRepairEnabled:
      Boolean(
        configuration?.boardLevelRepair?.enabled,
      ),

    boardRepairRatePercent:
      configuration?.boardLevelRepair
        ?.ratePercent ?? "",

    repairFee:
      configuration?.repairFee?.amount ??
      "",

    notes:
      account?.configurationState ===
        "CONFIGURED"
        ? account?.latestSavedVersion
            ?.notes || ""
        : "",
  }
}

function stateBadge(state) {
  if (state === "CONFIGURED") {
    return {
      label: "Configured",
      tone: "green",
    }
  }

  if (state === "STALE_CLASSIFICATION") {
    return {
      label: "Needs Review",
      tone: "maroon",
    }
  }

  return {
    label: "Not Configured",
    tone: "gray",
  }
}

function validateEnabledRate(
  enabled,
  rawValue,
  label,
) {
  if (!enabled) {
    return {
      ok: true,
      value: null,
    }
  }

  if (
    rawValue === "" ||
    rawValue === null ||
    rawValue === undefined
  ) {
    return {
      ok: false,
      message:
        `${label} rate is required when enabled.`,
    }
  }

  const value =
    Number(rawValue)

  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 100
  ) {
    return {
      ok: false,
      message:
        `${label} rate must be greater than 0% and not more than 100%.`,
    }
  }

  return {
    ok: true,
    value,
  }
}

function ToggleRateField({
  available,
  enabled,
  label,
  rate,
  disabled,
  onEnabledChange,
  onRateChange,
}) {
  if (!available) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 opacity-75">
        <p className="font-bold text-[var(--color-text-strong)]">
          {label}
        </p>

        <p className="mt-2 text-sm font-semibold text-[var(--color-muted)]">
          Not available for this account type.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
      <button
        className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-70"
        disabled={disabled}
        onClick={() =>
          onEnabledChange(!enabled)
        }
        type="button"
      >
        <span
          className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${
            enabled
              ? "border-[var(--color-maroon)] bg-[var(--color-maroon)]"
              : "border-[var(--color-border)] bg-white"
          }`}
        >
          {enabled ? (
            <span className="size-2 rounded-full bg-white" />
          ) : null}
        </span>

        <span className="min-w-0">
          <span className="block font-bold text-[var(--color-text-strong)]">
            {label}
          </span>

          <span className="mt-1 block text-xs leading-5 text-[var(--color-muted)]">
            {enabled
              ? "Enabled for this account."
              : "Disabled for this account."}
          </span>
        </span>
      </button>

      <label className="mt-4 block">
        <span className="text-xs font-black uppercase tracking-[0.1em] text-[var(--color-muted)]">
          Rate %
        </span>

        <input
          className="mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 text-sm font-bold outline-none transition focus:border-[var(--color-maroon)] disabled:bg-[var(--color-soft)] disabled:text-[var(--color-muted)]"
          disabled={
            disabled ||
            !enabled
          }
          inputMode="decimal"
          max="100"
          min="0.0001"
          onChange={(event) =>
            onRateChange(
              event.target.value,
            )
          }
          placeholder={
            enabled
              ? "Example: 2.5"
              : "Enable first"
          }
          step="0.0001"
          type="number"
          value={rate}
        />
      </label>
    </div>
  )
}

function AccountCard({
  account,
  draft,
  canManage,
  isSaving,
  onDraftChange,
  onReset,
  onSave,
}) {
  const badge =
    stateBadge(
      account.configurationState,
    )

  const branchLabel =
    account?.branch?.code
      ? `${account.branch.code} — ${account.branch.name}`
      : "No branch assigned"

  const isTechnical =
    Boolean(
      account?.eligibility
        ?.repairFee,
    )

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-black text-[var(--color-text-strong)]">
              {account.fullName}
            </h4>

            <Badge tone={badge.tone}>
              {badge.label}
            </Badge>
          </div>

          <p className="mt-2 text-sm font-bold text-[var(--color-maroon)]">
            {accountTypeLabel(account)}
          </p>

          <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
            {branchLabel}
            {account.employeeCode
              ? ` · ${account.employeeCode}`
              : ""}
          </p>
        </div>

        <div className="rounded-xl bg-[var(--color-soft)] px-3 py-2 text-xs font-bold text-[var(--color-muted)]">
          {canManage
            ? "Per-account settings"
            : "Viewing only"}
        </div>
      </div>

      {account.configurationState ===
      "STALE_CLASSIFICATION" ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
          The account type changed after its last saved
          incentive configuration. Current eligibility is shown
          below with all affected incentives safely disabled until
          a new version is saved.
        </div>
      ) : null}

      <div className={`mt-5 grid gap-3 ${isTechnical ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        <ToggleRateField
          available={true}
          disabled={!canManage || isSaving}
          enabled={draft.itemEnabled}
          label="Item Sale Incentive"
          onEnabledChange={(value) =>
            onDraftChange("itemEnabled", value)
          }
          onRateChange={(value) =>
            onDraftChange("itemRatePercent", value)
          }
          rate={draft.itemRatePercent}
        />

        <ToggleRateField
          available={true}
          disabled={!canManage || isSaving}
          enabled={draft.ordinaryRepairEnabled}
          label="Ordinary Repair Incentive"
          onEnabledChange={(value) =>
            onDraftChange("ordinaryRepairEnabled", value)
          }
          onRateChange={(value) =>
            onDraftChange("ordinaryRepairRatePercent", value)
          }
          rate={draft.ordinaryRepairRatePercent}
        />

        <ToggleRateField
          available={true}
          disabled={!canManage || isSaving}
          enabled={draft.boardRepairEnabled}
          label="Board Level Repair Incentive"
          onEnabledChange={(value) =>
            onDraftChange("boardRepairEnabled", value)
          }
          onRateChange={(value) =>
            onDraftChange("boardRepairRatePercent", value)
          }
          rate={draft.boardRepairRatePercent}
        />

        {isTechnical ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4 flex flex-col justify-between">
            <div>
              <span className="block font-bold text-[var(--color-text-strong)]">
                Repair Fee (₱)
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--color-muted)]">
                Fixed repair charge fee (optional)
              </span>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-[0.1em] text-[var(--color-muted)]">
                Amount ₱
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 text-sm font-bold outline-none transition focus:border-[var(--color-maroon)] disabled:bg-[var(--color-soft)]"
                disabled={!canManage || isSaving}
                inputMode="decimal"
                min="0"
                onChange={(e) => onDraftChange("repairFee", e.target.value)}
                placeholder="Optional fee"
                step="0.01"
                type="number"
                value={draft.repairFee}
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <label className="block rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4">
          <span className="font-bold text-[var(--color-text-strong)]">
            Configuration Notes
          </span>

          <span className="mt-1 block text-xs leading-5 text-[var(--color-muted)]">
            Optional note saved with this configuration version.
          </span>

          <input
            className="mt-3 h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 text-sm outline-none focus:border-[var(--color-maroon)] disabled:bg-[var(--color-soft)] disabled:text-[var(--color-muted)]"
            disabled={
              !canManage ||
              isSaving
            }
            maxLength={1000}
            onChange={(event) =>
              onDraftChange(
                "notes",
                event.target.value,
              )
            }
            placeholder="Optional"
            type="text"
            value={draft.notes}
          />
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          className="h-11 rounded-xl bg-[var(--color-maroon)] px-5 text-sm font-black text-white transition hover:bg-[var(--color-maroon-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            !canManage ||
            isSaving ||
            !account.branchId
          }
          onClick={onSave}
          type="button"
        >
          {!canManage
            ? "View Only"
            : isSaving
              ? "Saving..."
              : "Save Account Configuration"}
        </button>

        <button
          className="h-11 rounded-xl border border-[var(--color-border)] bg-white px-5 text-sm font-black text-[var(--color-text-strong)] transition hover:bg-[var(--color-soft)] disabled:opacity-60"
          disabled={isSaving}
          onClick={onReset}
          type="button"
        >
          Reset
        </button>
      </div>
    </Card>
  )
}

export default function IncentiveAccountSettingsV2({
  canManage = false,
}) {
  const [scope, setScope] =
    useState(null)

  const [accounts, setAccounts] =
    useState([])

  const [drafts, setDrafts] =
    useState({})

  const [isLoading, setIsLoading] =
    useState(true)

  const [savingAccountId, setSavingAccountId] =
    useState("")

  const [message, setMessage] =
    useState("")

  const [errorMessage, setErrorMessage] =
    useState("")

  const load =
    useCallback(async () => {
      setIsLoading(true)
      setErrorMessage("")

      try {
        const response =
          await getIncentiveAccountConfigurations()

        const result =
          response?.data || null

        if (
          !result ||
          !Array.isArray(result.accounts)
        ) {
          throw new Error(
            "Invalid incentive account configuration response.",
          )
        }

        setScope(
          result.scope || null,
        )

        setAccounts(
          result.accounts,
        )

        setDrafts(
          Object.fromEntries(
            result.accounts.map(
              (account) => [
                account.id,
                accountDraft(account),
              ],
            ),
          ),
        )
      } catch (error) {
        setErrorMessage(
          apiMessage(
            error,
            "Unable to load incentive account configuration.",
          ),
        )
      } finally {
        setIsLoading(false)
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

  const groupedAccounts =
    useMemo(() => {
      const groups =
        new Map()

      for (const account of accounts) {
        const key =
          account.branchId ||
          "NO_BRANCH"

        if (!groups.has(key)) {
          groups.set(
            key,
            {
              branch:
                account.branch ||
                null,

              accounts: [],
            },
          )
        }

        groups
          .get(key)
          .accounts.push(
            account,
          )
      }

      return [
        ...groups.values(),
      ]
    }, [accounts])

  const updateDraft = (
    accountId,
    field,
    value,
  ) => {
    setDrafts(
      (current) => ({
        ...current,

        [accountId]: {
          ...current[
            accountId
          ],

          [field]:
            value,
        },
      }),
    )

    setMessage("")
    setErrorMessage("")
  }

  const resetAccount = (
    account,
  ) => {
    setDrafts(
      (current) => ({
        ...current,

        [account.id]:
          accountDraft(
            account,
          ),
      }),
    )

    setMessage("")
    setErrorMessage("")
  }

  const saveAccount =
    async (account) => {
      const draft =
        drafts[account.id]

      if (!draft) {
        return
      }

      setMessage("")
      setErrorMessage("")

      const item =
        validateEnabledRate(
          draft.itemEnabled,
          draft.itemRatePercent,
          "Item Sale Incentive",
        )

      if (!item.ok) {
        setErrorMessage(
          `${account.fullName}: ${item.message}`,
        )
        return
      }

      const ordinary =
        validateEnabledRate(
          draft
            .ordinaryRepairEnabled,
          draft
            .ordinaryRepairRatePercent,
          "Ordinary Repair Incentive",
        )

      if (!ordinary.ok) {
        setErrorMessage(
          `${account.fullName}: ${ordinary.message}`,
        )
        return
      }

      const board =
        validateEnabledRate(
          draft
            .boardRepairEnabled,
          draft
            .boardRepairRatePercent,
          "Board Level Repair Incentive",
        )

      if (!board.ok) {
        setErrorMessage(
          `${account.fullName}: ${board.message}`,
        )
        return
      }

      const repairFee =
        draft.repairFee === "" ||
        draft.repairFee === null ||
        draft.repairFee ===
          undefined
          ? null
          : Number(
              draft.repairFee,
            )

      if (
        repairFee !== null &&
        (
          !Number.isFinite(
            repairFee,
          ) ||
          repairFee < 0 ||
          repairFee >
            9999999999.99
        )
      ) {
        setErrorMessage(
          `${account.fullName}: Repair Fee must be zero or greater.`,
        )
        return
      }

      const itemAvailable =
        Boolean(
          account?.eligibility
            ?.item,
        )

      const ordinaryAvailable =
        Boolean(
          account?.eligibility
            ?.ordinaryRepair,
        )

      const boardAvailable =
        Boolean(
          account?.eligibility
            ?.boardLevelRepair,
        )

      const repairFeeAvailable =
        Boolean(
          account?.eligibility
            ?.repairFee,
        )

      const payload = {
        itemEnabled:
          itemAvailable
            ? Boolean(
                draft.itemEnabled,
              )
            : false,

        itemRatePercent:
          itemAvailable &&
          draft.itemEnabled
            ? item.value
            : null,

        ordinaryRepairEnabled:
          ordinaryAvailable
            ? Boolean(
                draft
                  .ordinaryRepairEnabled,
              )
            : false,

        ordinaryRepairRatePercent:
          ordinaryAvailable &&
          draft
            .ordinaryRepairEnabled
            ? ordinary.value
            : null,

        boardRepairEnabled:
          boardAvailable
            ? Boolean(
                draft
                  .boardRepairEnabled,
              )
            : false,

        boardRepairRatePercent:
          boardAvailable &&
          draft
            .boardRepairEnabled
            ? board.value
            : null,

        repairFee:
          repairFeeAvailable
            ? repairFee
            : null,

        notes:
          draft.notes.trim() ||
          null,
      }

      setSavingAccountId(
        account.id,
      )

      try {
        const response =
          await createIncentiveAccountConfigurationVersion(
            account.id,
            payload,
          )

        if (
          !response?.success ||
          !response?.data
        ) {
          throw new Error(
            "Unable to save incentive account configuration.",
          )
        }

        setMessage(
          `${account.fullName} incentive configuration saved successfully.`,
        )

        await load()
      } catch (error) {
        setErrorMessage(
          apiMessage(
            error,
            `Unable to save ${account.fullName}'s incentive configuration.`,
          ),
        )
      } finally {
        setSavingAccountId(
          "",
        )
      }
    }

  const scopeLabel =
    scope?.type === "GLOBAL"
      ? "All active branches"
      : "Assigned branch only"

  return (
    <div className="space-y-4">
      <Card className="border-[var(--color-maroon)] ring-2 ring-[var(--color-maroon-soft)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge tone="maroon">
              Incentive Settings V2
            </Badge>

            <h3 className="mt-3 text-xl font-black text-[var(--color-text-strong)]">
              Incentive Account Configuration
            </h3>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--color-muted)]">
              Configure each active staff account independently.
              Creating a staff account automatically makes it
              available here when its account type is incentive
              eligible.
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--color-soft)] px-4 py-3 text-sm font-bold text-[var(--color-muted)]">
            {scopeLabel}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] px-4 py-3 text-sm leading-6 text-[var(--color-muted)]">
          Incentive categories are not enabled automatically by
          account type. New or reclassified staff remain OFF until
          Main Admin or the assigned branch Admin saves their
          configuration.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="gray">
            Item: sales & staff accounts
          </Badge>

          <Badge tone="gray">
            Ordinary: technician & service staff
          </Badge>

          <Badge tone="gray">
            Board Level: senior technicians & repairs
          </Badge>
        </div>
      </Card>

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

      {isLoading ? (
        <Card>
          <p className="text-sm font-bold text-[var(--color-muted)]">
            Loading active incentive accounts...
          </p>
        </Card>
      ) : null}

      {!isLoading &&
      accounts.length === 0 ? (
        <Card>
          <p className="font-bold text-[var(--color-text-strong)]">
            No active eligible staff accounts
          </p>

          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Active Sales Agent and Technician account types will
            automatically appear here.
          </p>
        </Card>
      ) : null}

      {!isLoading
        ? groupedAccounts.map(
            (group) => {
              const branchTitle =
                group.branch
                  ? `${group.branch.code} — ${group.branch.name}`
                  : "No Branch"

              return (
                <section
                  className="space-y-3"
                  key={
                    group.branch?.id ||
                    "NO_BRANCH"
                  }
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-maroon)]">
                        Branch
                      </p>

                      <h3 className="mt-1 text-lg font-black text-[var(--color-text-strong)]">
                        {branchTitle}
                      </h3>
                    </div>

                    <span className="text-sm font-semibold text-[var(--color-muted)]">
                      {
                        group.accounts
                          .length
                      }{" "}
                      active staff
                    </span>
                  </div>

                  <div className="grid gap-4">
                    {group.accounts.map(
                      (
                        account,
                      ) => (
                        <AccountCard
                          account={
                            account
                          }
                          canManage={
                            canManage
                          }
                          draft={
                            drafts[
                              account.id
                            ] ||
                            accountDraft(
                              account,
                            )
                          }
                          isSaving={
                            savingAccountId ===
                            account.id
                          }
                          key={
                            account.id
                          }
                          onDraftChange={(
                            field,
                            value,
                          ) =>
                            updateDraft(
                              account.id,
                              field,
                              value,
                            )
                          }
                          onReset={() =>
                            resetAccount(
                              account,
                            )
                          }
                          onSave={() =>
                            void saveAccount(
                              account,
                            )
                          }
                        />
                      ),
                    )}
                  </div>
                </section>
              )
            },
          )
        : null}
    </div>
  )
}