import { useCallback, useEffect, useState } from "react"

import Badge from "../../components/ui/Badge"
import Card from "../../components/ui/Card"
import { getIncentiveProgramReadiness } from "./incentiveEngineV2.api"

const PROGRAM_LABELS = {
  ITEM_SALE: "Item Sale",
  ORDINARY_REPAIR: "Ordinary Repair",
  BOARD_LEVEL_REPAIR: "Board Level Repair",
}

const WARNING_LABELS = {
  PROGRAM_RULE_UNCONFIGURED: "Program rule not configured",
  PROGRAM_SCHEDULE_UNCONFIGURED: "Program schedule not configured",
  MANUAL_PROGRAM_CYCLE_UNAVAILABLE: "No earning manual cycle",
  NO_ELIGIBLE_PRICE_TIERS: "No eligible price tiers",
  REPAIR_COST_PERCENT_UNCONFIGURED: "Repair cost percent not configured",
  NO_ENABLED_RECIPIENTS: "No enabled recipients",
}

function apiMessage(error, fallback) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

function ProgramReadinessCard({ program }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-black text-[var(--color-text-strong)]">
          {PROGRAM_LABELS[program.programType] || program.programType}
        </h4>
        <Badge tone={program.readyForPosting ? "maroon" : "default"}>
          {program.readyForPosting ? "Ready" : "Needs setup"}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-[var(--color-soft)] p-3">
          <dt className="text-xs font-bold text-[var(--color-muted)]">
            Eligible staff
          </dt>
          <dd className="mt-1 font-black">{program.eligibleRecipientCount}</dd>
        </div>
        <div className="rounded-xl bg-[var(--color-soft)] p-3">
          <dt className="text-xs font-bold text-[var(--color-muted)]">
            Enabled staff
          </dt>
          <dd className="mt-1 font-black">{program.enabledRecipientCount}</dd>
        </div>
      </dl>

      <div className="mt-3 space-y-1 text-xs text-[var(--color-muted)]">
        <p>
          Configuration: {program.configurationReady ? "Ready" : "Incomplete"}
        </p>
        <p>Cycle: {program.cycleReady ? "Ready" : "Unavailable"}</p>
        <p>
          Payable recipients: {program.payableRecipientReady ? "Ready" : "None"}
        </p>
        <p>Rule: {program.ruleVersionId ? "Configured" : "Missing"}</p>
        <p>
          Schedule: {program.scheduleType || "Missing"}
          {program.earningCycleId ? " · Earning cycle available" : ""}
        </p>
      </div>

      {program.warnings?.length ? (
        <ul className="mt-3 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
          {program.warnings.map((warning) => (
            <li key={warning}>{WARNING_LABELS[warning] || warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function IncentiveProgramReadinessV2({ branchId = "" }) {
  const [readiness, setReadiness] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  const requestReadiness = useCallback(
    () =>
      getIncentiveProgramReadiness(
        branchId ? { branchId } : {},
      ),
    [branchId],
  )

  const loadReadiness = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")

    try {
      const response = await requestReadiness()

      if (!response?.success || !response?.data) {
        throw new Error("Invalid V2 incentive readiness response.")
      }

      setReadiness(response.data)
    } catch (error) {
      setErrorMessage(
        apiMessage(error, "Unable to load V2 incentive readiness."),
      )
    } finally {
      setIsLoading(false)
    }
  }, [requestReadiness])

  useEffect(() => {
    let ignore = false

    requestReadiness()
      .then((response) => {
        if (ignore) return

        if (!response?.success || !response?.data) {
          throw new Error("Invalid V2 incentive readiness response.")
        }

        setReadiness(response.data)
      })
      .catch((error) => {
        if (!ignore) {
          setErrorMessage(
            apiMessage(error, "Unable to load V2 incentive readiness."),
          )
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [requestReadiness])

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-maroon)]">
            V2 posting readiness
          </p>
          <h3 className="mt-1 text-xl font-black text-[var(--color-text-strong)]">
            Branch incentive programs
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Rule, schedule, cycle, and recipient readiness for the three
            independent Asia/Manila programs.
          </p>
        </div>

        <button
          className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-black disabled:opacity-50"
          disabled={isLoading}
          onClick={loadReadiness}
          type="button"
        >
          Refresh
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-5 text-sm font-bold text-[var(--color-muted)]">
          Loading V2 incentive readiness...
        </p>
      ) : null}

      {!isLoading && readiness?.branches?.length ? (
        <div className="mt-5 space-y-5">
          {readiness.branches.map((entry) => (
            <section key={entry.branch.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-black text-[var(--color-text-strong)]">
                  {entry.branch.code} · {entry.branch.name}
                </h4>
                <Badge>{readiness.businessTimeZone}</Badge>
              </div>
              <div className="mt-3 grid gap-3 xl:grid-cols-3">
                {entry.programs.map((program) => (
                  <ProgramReadinessCard
                    key={program.programType}
                    program={program}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {!isLoading && !errorMessage && !readiness?.branches?.length ? (
        <p className="mt-5 rounded-xl bg-[var(--color-soft)] p-4 text-sm font-bold text-[var(--color-muted)]">
          No active branch is available for V2 incentive readiness.
        </p>
      ) : null}
    </Card>
  )
}

export default IncentiveProgramReadinessV2
