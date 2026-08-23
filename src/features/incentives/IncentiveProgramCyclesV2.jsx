import { useCallback, useEffect, useMemo, useState } from "react"

import Badge from "../../components/ui/Badge"
import Card from "../../components/ui/Card"
import {
  claimIncentiveProgramCycle,
  createManualIncentiveProgramCycle,
  getIncentiveProgramCycles,
  getIncentiveProgramReadiness,
  materializeItemIncentiveCycle,
  materializeItemIncentiveCycleForDate,
} from "./incentiveEngineV2.api"

const MANAGER_ROLES = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN"])
const PROGRAMS = [
  { value: "ITEM_SALE", label: "Item Sale" },
  { value: "ORDINARY_REPAIR", label: "Ordinary Repair" },
  { value: "BOARD_LEVEL_REPAIR", label: "Board Level Repair" },
]

function money(value) {
  return `\u20B1${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function dateOnly(value) {
  if (!value) return "-"
  return String(value).slice(0, 10)
}

function dateTime(value) {
  if (!value) return "-"
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? "-"
    : parsed.toLocaleString("en-PH")
}

function manilaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

function apiMessage(error, fallback) {
  const payload = error?.response?.data
  const message =
    payload?.error?.message || payload?.message || error?.message || fallback
  const details = payload?.error?.details || payload?.details

  if (!details?.count) return message

  const sources = (details.sources || [])
    .slice(0, 5)
    .map((source) => source.receiptCode || source.saleItemId || source.saleId)
    .filter(Boolean)

  return `${message} ${details.count} source(s) require review${
    sources.length ? `: ${sources.join(", ")}` : "."
  }`
}

function statusTone(status) {
  return status === "CLAIMABLE" || status === "EARNING"
    ? "maroon"
    : "default"
}

function CycleDates({ cycle }) {
  return (
    <p className="text-xs text-[var(--color-muted)]">
      {dateOnly(cycle.startDate)} to {dateOnly(cycle.endDate)} / Claim {dateOnly(cycle.claimOpenDate)} to {dateOnly(cycle.claimCloseDate)}
    </p>
  )
}

function ManagerCycleDetail({ cycle }) {
  const revision = cycle.itemCycleRevisions?.[0] || null

  return (
    <article className="rounded-2xl border border-[var(--color-border)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-black text-[var(--color-text-strong)]">
            {cycle.periodCode}
          </p>
          <CycleDates cycle={cycle} />
        </div>
        <Badge tone={statusTone(cycle.status)}>{cycle.status}</Badge>
      </div>

      {cycle.programType === "ITEM_SALE" ? (
        <div className="mt-3 rounded-xl bg-[var(--color-soft)] p-3 text-xs">
          {revision ? (
            <>
              <p className="font-black">
                Revision {revision.revisionNumber} / Basis {money(revision.branchBasisAmountSnapshot)}
              </p>
              <p className="mt-1 text-[var(--color-muted)]">
                Materialized {dateTime(revision.materializedAt)} / Fingerprint {String(revision.calculationFingerprint || "-").slice(0, 12)}
              </p>
            </>
          ) : (
            <p className="font-bold text-[var(--color-muted)]">
              No item basis revision materialized.
            </p>
          )}
        </div>
      ) : null}
    </article>
  )
}

function StaffCycleDetail({ cycle, busyKey, claimNotes, onClaim, onNotes }) {
  const awards = cycle.ownAwards || []
  const total = awards.reduce((sum, award) => sum + Number(award.amount || 0), 0)
  const canClaim =
    cycle.status === "CLAIMABLE" && awards.length > 0 && !cycle.ownClaim

  return (
    <article className="rounded-2xl border border-[var(--color-border)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-black text-[var(--color-text-strong)]">
            {cycle.periodCode}
          </p>
          <CycleDates cycle={cycle} />
        </div>
        <Badge tone={statusTone(cycle.status)}>{cycle.status}</Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-[var(--color-soft)] p-3">
          <p className="text-xs font-bold text-[var(--color-muted)]">My payable award</p>
          <p className="mt-1 font-black text-[var(--color-maroon)]">{money(total)}</p>
        </div>
        <div className="rounded-xl bg-[var(--color-soft)] p-3">
          <p className="text-xs font-bold text-[var(--color-muted)]">Claim</p>
          <p className="mt-1 font-black">{cycle.ownClaim?.status || "UNCLAIMED"}</p>
        </div>
      </div>

      {awards.length ? (
        <ul className="mt-3 space-y-1 text-xs text-[var(--color-muted)]">
          {awards.map((award) => (
            <li key={award.id}>
              {award.sourceCode}: {money(award.amount)} at {Number(award.ratePercent || 0).toFixed(4)}%
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs font-bold text-[var(--color-muted)]">
          No payable V2 award is posted for you in this cycle.
        </p>
      )}

      {canClaim ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            aria-label={`Claim notes for ${cycle.periodCode}`}
            className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
            maxLength={1000}
            onChange={(event) => onNotes(cycle.id, event.target.value)}
            placeholder="Optional claim notes"
            value={claimNotes[cycle.id] || ""}
          />
          <button
            className="rounded-xl bg-[var(--color-maroon)] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            disabled={busyKey === `claim:${cycle.id}`}
            onClick={() => onClaim(cycle)}
            type="button"
          >
            {busyKey === `claim:${cycle.id}` ? "Claiming..." : "Claim my award"}
          </button>
        </div>
      ) : null}
    </article>
  )
}

function IncentiveProgramCyclesV2({ branchId = "", user }) {
  const managerView = MANAGER_ROLES.has(user?.role)
  const [cycles, setCycles] = useState([])
  const [readiness, setReadiness] = useState(null)
  const [manualDates, setManualDates] = useState(() =>
    Object.fromEntries(
      PROGRAMS.map((program) => [
        program.value,
        { startDate: manilaToday(), endDate: manilaToday() },
      ]),
    ),
  )
  const [materializeDate, setMaterializeDate] = useState(manilaToday)
  const [claimNotes, setClaimNotes] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [busyKey, setBusyKey] = useState("")
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const canLoad = Boolean(branchId)

  const loadCycles = useCallback(async () => {
    if (!canLoad) {
      setCycles([])
      setReadiness(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setErrorMessage("")

    try {
      const [cycleResponse, readinessResponse] = await Promise.all([
        getIncentiveProgramCycles({ branchId, limit: 100 }),
        managerView
          ? getIncentiveProgramReadiness({ branchId })
          : Promise.resolve(null),
      ])
      setCycles(Array.isArray(cycleResponse?.data) ? cycleResponse.data : [])
      setReadiness(readinessResponse?.data || null)
    } catch (error) {
      setCycles([])
      setReadiness(null)
      setErrorMessage(apiMessage(error, "Unable to load V2 program cycles."))
    } finally {
      setIsLoading(false)
    }
  }, [branchId, canLoad, managerView])

  useEffect(() => {
    const timer = window.setTimeout(loadCycles, 0)
    return () => window.clearTimeout(timer)
  }, [loadCycles])

  const cyclesByProgram = useMemo(
    () =>
      Object.fromEntries(
        PROGRAMS.map((program) => [
          program.value,
          cycles.filter((cycle) => cycle.programType === program.value),
        ]),
      ),
    [cycles],
  )

  const readinessByProgram = useMemo(() => {
    const branch = readiness?.branches?.find(
      (entry) => entry.branch?.id === branchId,
    )
    return Object.fromEntries(
      (branch?.programs || []).map((program) => [program.programType, program]),
    )
  }, [branchId, readiness])

  const perform = async (key, successMessage, callback) => {
    setBusyKey(key)
    setMessage("")
    setErrorMessage("")

    try {
      const response = await callback()
      if (!response?.success) throw new Error("Invalid V2 incentive response.")
      setMessage(successMessage)
      await loadCycles()
    } catch (error) {
      setErrorMessage(apiMessage(error, "V2 incentive action failed."))
    } finally {
      setBusyKey("")
    }
  }

  const createManualCycle = (programType) => {
    const dates = manualDates[programType]
    return perform(
      `manual:${programType}`,
      `${PROGRAMS.find((program) => program.value === programType)?.label} cycle created.`,
      () =>
        createManualIncentiveProgramCycle({
          branchId,
          programType,
          startDate: dates.startDate,
          endDate: dates.endDate,
        }),
    )
  }

  const updateManualDate = (programType, field, value) => {
    setManualDates((current) => ({
      ...current,
      [programType]: { ...current[programType], [field]: value },
    }))
  }

  const claimCycle = (cycle) =>
    perform(`claim:${cycle.id}`, "V2 incentive claim submitted.", () =>
      claimIncentiveProgramCycle(cycle.id, {
        notes: claimNotes[cycle.id] || null,
      }),
    )

  if (!canLoad) {
    return (
      <Card>
        <p className="font-black text-[var(--color-text-strong)]">V2 program cycles</p>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Select a branch to view its three independent incentive programs.
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-maroon)]">
            V2 program cycles
          </p>
          <h2 className="mt-1 text-xl font-black text-[var(--color-text-strong)]">
            Independent branch awards
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
            Item Sale, Ordinary Repair, and Board Level Repair use separate Asia/Manila schedules and claims.
          </p>
        </div>
        <button
          className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-black disabled:opacity-50"
          disabled={isLoading || Boolean(busyKey)}
          onClick={loadCycles}
          type="button"
        >
          {isLoading ? "Loading..." : "Refresh V2"}
        </button>
      </div>

      {message ? (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
          {message}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {PROGRAMS.map((program) => {
          const programCycles = cyclesByProgram[program.value] || []
          const programReadiness = readinessByProgram[program.value] || null
          const latestCycle = programCycles[0] || null
          const latestRevision = latestCycle?.itemCycleRevisions?.[0] || null
          const canRestate = Boolean(
            latestCycle &&
              program.value === "ITEM_SALE" &&
              ["CUT_OFF", "CLAIMABLE"].includes(latestCycle.status),
          )
          const canRestateClosed = Boolean(
            latestCycle?.status === "CLOSED" && latestRevision,
          )

          return (
            <section
              className="min-w-0 rounded-2xl border border-[var(--color-border)] p-4"
              key={program.value}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-[var(--color-text-strong)]">
                  {program.label}
                </h3>
                {managerView && programReadiness ? (
                  <Badge tone={programReadiness.readyForPosting ? "maroon" : "default"}>
                    {programReadiness.readyForPosting ? "Payable ready" : "Needs attention"}
                  </Badge>
                ) : null}
              </div>

              {managerView && programReadiness ? (
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-[var(--color-soft)] p-2">
                    <p className="font-black">{programReadiness.configurationReady ? "Yes" : "No"}</p>
                    <p className="text-[var(--color-muted)]">Config</p>
                  </div>
                  <div className="rounded-xl bg-[var(--color-soft)] p-2">
                    <p className="font-black">{programReadiness.cycleReady ? "Yes" : "No"}</p>
                    <p className="text-[var(--color-muted)]">Cycle</p>
                  </div>
                  <div className="rounded-xl bg-[var(--color-soft)] p-2">
                    <p className="font-black">{programReadiness.enabledRecipientCount || 0}</p>
                    <p className="text-[var(--color-muted)]">Enabled</p>
                  </div>
                </div>
              ) : null}

              {managerView && programReadiness?.scheduleType === "MANUAL" ? (
                <div className="mt-3 space-y-2 rounded-xl border border-[var(--color-border)] p-3">
                  <p className="text-xs font-black uppercase text-[var(--color-muted)]">
                    Create manual cycle
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      aria-label={`${program.label} manual start date`}
                      className="min-w-0 rounded-lg border border-[var(--color-border)] px-2 py-2 text-xs"
                      onChange={(event) =>
                        updateManualDate(program.value, "startDate", event.target.value)
                      }
                      type="date"
                      value={manualDates[program.value].startDate}
                    />
                    <input
                      aria-label={`${program.label} manual end date`}
                      className="min-w-0 rounded-lg border border-[var(--color-border)] px-2 py-2 text-xs"
                      onChange={(event) =>
                        updateManualDate(program.value, "endDate", event.target.value)
                      }
                      type="date"
                      value={manualDates[program.value].endDate}
                    />
                  </div>
                  <button
                    className="w-full rounded-lg bg-[var(--color-maroon)] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                    disabled={busyKey === `manual:${program.value}`}
                    onClick={() => createManualCycle(program.value)}
                    type="button"
                  >
                    {busyKey === `manual:${program.value}` ? "Creating..." : "Create cycle"}
                  </button>
                </div>
              ) : null}

              {managerView && program.value === "ITEM_SALE" ? (
                <div className="mt-3 space-y-2 rounded-xl border border-[var(--color-border)] p-3">
                  <p className="text-xs font-black uppercase text-[var(--color-muted)]">
                    Materialize item basis
                  </p>
                  <div className="flex gap-2">
                    <input
                      aria-label="Item cycle target date"
                      className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] px-2 py-2 text-xs"
                      onChange={(event) => setMaterializeDate(event.target.value)}
                      type="date"
                      value={materializeDate}
                    />
                    <button
                      className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-black disabled:opacity-50"
                      disabled={busyKey === "materialize-date"}
                      onClick={() =>
                        perform(
                          "materialize-date",
                          "Item cycle basis materialized.",
                          () =>
                            materializeItemIncentiveCycleForDate({
                              branchId,
                              targetDate: materializeDate,
                              reason: "Manager materialization from V2 monitor",
                            }),
                        )
                      }
                      type="button"
                    >
                      Run
                    </button>
                  </div>
                  {latestCycle ? (
                    <button
                      className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-black disabled:opacity-50"
                      disabled={
                        (!canRestate && !canRestateClosed) ||
                        busyKey === `materialize:${latestCycle.id}`
                      }
                      onClick={() =>
                        perform(
                          `materialize:${latestCycle.id}`,
                          "Item cycle revision refreshed.",
                          () =>
                            materializeItemIncentiveCycle(latestCycle.id, {
                              reason: "Manager refresh from V2 monitor",
                            }),
                        )
                      }
                      type="button"
                    >
                      {busyKey === `materialize:${latestCycle.id}`
                        ? "Refreshing..."
                        : "Refresh latest revision"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 space-y-3">
                {isLoading ? (
                  <p className="rounded-xl bg-[var(--color-soft)] p-3 text-sm font-bold text-[var(--color-muted)]">
                    Loading cycles...
                  </p>
                ) : programCycles.length ? (
                  programCycles.slice(0, 4).map((cycle) =>
                    managerView ? (
                      <ManagerCycleDetail cycle={cycle} key={cycle.id} />
                    ) : (
                      <StaffCycleDetail
                        busyKey={busyKey}
                        claimNotes={claimNotes}
                        cycle={cycle}
                        key={cycle.id}
                        onClaim={claimCycle}
                        onNotes={(cycleId, value) =>
                          setClaimNotes((current) => ({
                            ...current,
                            [cycleId]: value,
                          }))
                        }
                      />
                    ),
                  )
                ) : (
                  <p className="rounded-xl bg-[var(--color-soft)] p-3 text-sm font-bold text-[var(--color-muted)]">
                    No persisted {program.label} cycle yet.
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </Card>
  )
}

export default IncentiveProgramCyclesV2
