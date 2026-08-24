import { useCallback, useEffect, useMemo, useState } from "react"

import Card from "../../components/ui/Card"
import {
  createManualIncentiveCycle,
  createIncentiveRateVersion,
  createIncentiveScheduleVersion,
  getIncentiveConfiguration,
  initializeEnterpriseIncentives,
  previewIncentiveSchedule,
} from "./incentives.api"

const CLASSIFICATIONS = [
  ["SALES_AGENT", "Sales Agent"],
  ["SENIOR_SALES_AGENT", "Senior Sales Agent"],
  ["TECHNICIAN", "Technician"],
  ["SENIOR_TECHNICIAN", "Senior Technician"],
]

function messageFrom(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || fallback
}

function dateLabel(value) {
  if (!value) return "—"
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
}

function blankRates(version) {
  const rows = new Map((version?.rates || []).map((row) => [row.classification, row]))
  return Object.fromEntries(
    CLASSIFICATIONS.map(([classification]) => [
      classification,
      {
        productRate: rows.has(classification) ? String(rows.get(classification).productRate) : "",
        serviceRate: rows.has(classification) ? String(rows.get(classification).serviceRate) : "",
      },
    ]),
  )
}

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 text-sm font-bold outline-none focus:border-[var(--color-maroon)] disabled:bg-[var(--color-soft)] disabled:text-[var(--color-muted)]"

export default function EnterpriseIncentiveSettings({ canManage }) {
  const [configuration, setConfiguration] = useState(null)
  const [rates, setRates] = useState(() => blankRates(null))
  const [rateEffectiveFrom, setRateEffectiveFrom] = useState("")
  const [rateNotes, setRateNotes] = useState("")
  const [schedule, setSchedule] = useState({
    scheduleType: "EVERY_N_DAYS",
    anchorDate: "",
    effectiveFrom: "",
    everyNDays: "",
    claimOpenAfterDays: "",
    claimWindowDays: "",
    notes: "",
  })
  const [preview, setPreview] = useState([])
  const [manualCycle, setManualCycle] = useState({
    scheduleVersionId: "",
    startDate: "",
    endDate: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [busyAction, setBusyAction] = useState("")
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const load = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage("")
    try {
      const response = await getIncentiveConfiguration()
      const result = response?.data || null
      setConfiguration(result)
      setRates(blankRates(result?.currentRateVersion))
      const newestManualVersion = (result?.scheduleVersions || []).find(
        (version) => version.scheduleType === "MANUAL",
      )
      setManualCycle((current) => ({
        ...current,
        scheduleVersionId: current.scheduleVersionId || newestManualVersion?.id || "",
      }))
    } catch (error) {
      setErrorMessage(messageFrom(error, "Unable to load enterprise incentive configuration."))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const updateSchedule = (field, value) => {
    setSchedule((current) => ({ ...current, [field]: value }))
    setPreview([])
  }

  const schedulePayload = useMemo(
    () => ({
      scheduleType: schedule.scheduleType,
      anchorDate: schedule.anchorDate,
      effectiveFrom: schedule.effectiveFrom,
      everyNDays:
        schedule.scheduleType === "EVERY_N_DAYS" ? Number(schedule.everyNDays) : null,
      claimOpenAfterDays: Number(schedule.claimOpenAfterDays),
      claimWindowDays: Number(schedule.claimWindowDays),
      notes: schedule.notes.trim() || null,
    }),
    [schedule],
  )

  const manualVersions = useMemo(
    () => (configuration?.scheduleVersions || []).filter((version) => version.scheduleType === "MANUAL"),
    [configuration?.scheduleVersions],
  )

  const saveRates = async (event) => {
    event.preventDefault()
    setMessage("")
    setErrorMessage("")
    if (!rateEffectiveFrom) {
      setErrorMessage("Choose when the new rate matrix becomes effective.")
      return
    }
    const rows = CLASSIFICATIONS.map(([classification]) => ({
      classification,
      productRate: Number(rates[classification].productRate),
      serviceRate: Number(rates[classification].serviceRate),
    }))
    if (
      rows.some(
        (row) =>
          rates[row.classification].productRate === "" ||
          rates[row.classification].serviceRate === "" ||
          !Number.isFinite(row.productRate) ||
          !Number.isFinite(row.serviceRate) ||
          row.productRate < 0 ||
          row.productRate > 100 ||
          row.serviceRate < 0 ||
          row.serviceRate > 100,
      )
    ) {
      setErrorMessage("Enter a product and service percentage from 0 to 100 for every classification.")
      return
    }

    setBusyAction("rates")
    try {
      await createIncentiveRateVersion({
        effectiveFrom: rateEffectiveFrom,
        notes: rateNotes.trim() || null,
        rates: rows,
      })
      setMessage("A new immutable rate version was scheduled. Historical entries remain unchanged.")
      setRateEffectiveFrom("")
      setRateNotes("")
      await load()
    } catch (error) {
      setErrorMessage(messageFrom(error, "Unable to save the rate version."))
    } finally {
      setBusyAction("")
    }
  }

  const previewSchedule = async () => {
    setMessage("")
    setErrorMessage("")
    setBusyAction("preview")
    try {
      const response = await previewIncentiveSchedule({ ...schedulePayload, count: 6 })
      setPreview(response?.data?.periods || [])
      if (response?.data?.manualRequired) {
        setMessage("Manual schedules use explicitly created periods after this version is saved.")
      }
    } catch (error) {
      setPreview([])
      setErrorMessage(messageFrom(error, "Unable to preview this schedule."))
    } finally {
      setBusyAction("")
    }
  }

  const saveSchedule = async (event) => {
    event.preventDefault()
    setMessage("")
    setErrorMessage("")
    setBusyAction("schedule")
    try {
      await createIncentiveScheduleVersion(schedulePayload)
      setMessage("A new immutable schedule version was saved. Persisted historical periods were not changed.")
      setPreview([])
      await load()
    } catch (error) {
      setErrorMessage(messageFrom(error, "Unable to save the schedule version."))
    } finally {
      setBusyAction("")
    }
  }

  const initializeFromSavedRules = async () => {
    setMessage("")
    setErrorMessage("")
    setBusyAction("initialize")
    try {
      await initializeEnterpriseIncentives(schedulePayload)
      setMessage("Enterprise incentive rates and the selected claim schedule were initialized atomically from the saved business rules.")
      setPreview([])
      await load()
    } catch (error) {
      setErrorMessage(messageFrom(error, "Unable to initialize enterprise incentives."))
    } finally {
      setBusyAction("")
    }
  }

  const saveManualCycle = async (event) => {
    event.preventDefault()
    setMessage("")
    setErrorMessage("")
    if (!manualCycle.scheduleVersionId || !manualCycle.startDate || !manualCycle.endDate) {
      setErrorMessage("Choose a manual schedule version and enter its start and end dates.")
      return
    }
    setBusyAction("manual-cycle")
    try {
      await createManualIncentiveCycle(manualCycle)
      setMessage("The manual earning period and its claim window were saved without changing earlier cycles.")
      setManualCycle((current) => ({ ...current, startDate: "", endDate: "" }))
      await load()
    } catch (error) {
      setErrorMessage(messageFrom(error, "Unable to save the manual incentive period."))
    } finally {
      setBusyAction("")
    }
  }

  return (
    <Card className="border-[var(--color-maroon)]">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-maroon)]">Enterprise incentives</p>
          <h2 className="mt-2 text-xl font-black text-[var(--color-text-strong)]">Rate matrix and claim schedule</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
            Access roles stay separate from compensation classifications. Each saved version applies only from its effective date.
          </p>
        </div>
        <span className="rounded-full bg-[var(--color-soft)] px-3 py-1.5 text-xs font-black text-[var(--color-muted)]">
          {canManage ? "Super Owner configuration" : "View only"}
        </span>
      </div>

      {isLoading ? <p className="mt-5 text-sm font-bold text-[var(--color-muted)]">Loading incentive versions…</p> : null}
      {message ? <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</div> : null}
      {errorMessage ? <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{errorMessage}</div> : null}

      <form className="mt-6 space-y-4" onSubmit={saveRates}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-black text-[var(--color-text-strong)]">Incentive rate matrix</h3>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Current effective version: {dateLabel(configuration?.currentRateVersion?.effectiveFrom)}
            </p>
          </div>
          <label className="min-w-56 text-sm font-bold">
            Effective date
            <input className={inputClass} disabled={!canManage || Boolean(busyAction)} onChange={(event) => setRateEffectiveFrom(event.target.value)} type="date" value={rateEffectiveFrom} />
          </label>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-[var(--color-soft)] text-xs uppercase text-[var(--color-muted)]">
              <tr><th className="px-4 py-3">Classification</th><th className="px-4 py-3">Product %</th><th className="px-4 py-3">Service %</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {CLASSIFICATIONS.map(([classification, label]) => (
                <tr key={classification}>
                  <td className="px-4 py-3 font-black">{label}</td>
                  {["productRate", "serviceRate"].map((field) => (
                    <td className="px-4 py-3" key={field}>
                      <input
                        aria-label={`${label} ${field === "productRate" ? "product" : "service"} rate`}
                        className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-strong)] px-3 font-bold disabled:bg-[var(--color-soft)] disabled:text-[var(--color-muted)]"
                        disabled={!canManage || Boolean(busyAction)}
                        max="100"
                        min="0"
                        onChange={(event) => setRates((current) => ({ ...current, [classification]: { ...current[classification], [field]: event.target.value } }))}
                        step="0.0001"
                        type="number"
                        value={rates[classification][field]}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="block text-sm font-bold">Rate version notes<input className={inputClass} disabled={!canManage || Boolean(busyAction)} maxLength={1000} onChange={(event) => setRateNotes(event.target.value)} value={rateNotes} /></label>
        <button className="rounded-2xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-black text-white disabled:opacity-50" disabled={!canManage || Boolean(busyAction)} type="submit">{busyAction === "rates" ? "Saving…" : "Save new rate version"}</button>
      </form>

      <div className="my-7 border-t border-[var(--color-border)]" />

      <form className="space-y-4" onSubmit={saveSchedule}>
        <div>
          <h3 className="font-black text-[var(--color-text-strong)]">Incentive claim schedule</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Current effective version: {dateLabel(configuration?.currentScheduleVersion?.effectiveFrom)}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-bold">Schedule type<select className={inputClass} disabled={!canManage || Boolean(busyAction)} onChange={(event) => updateSchedule("scheduleType", event.target.value)} value={schedule.scheduleType}><option value="EVERY_N_DAYS">Every N days</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="MANUAL">Custom / manual</option></select></label>
          <label className="text-sm font-bold">Anchor / start date<input className={inputClass} disabled={!canManage || Boolean(busyAction)} onChange={(event) => updateSchedule("anchorDate", event.target.value)} type="date" value={schedule.anchorDate} /></label>
          <label className="text-sm font-bold">Effective date<input className={inputClass} disabled={!canManage || Boolean(busyAction)} onChange={(event) => updateSchedule("effectiveFrom", event.target.value)} type="date" value={schedule.effectiveFrom} /></label>
          {schedule.scheduleType === "EVERY_N_DAYS" ? <label className="text-sm font-bold">Cycle length (days)<input className={inputClass} disabled={!canManage || Boolean(busyAction)} min="1" onChange={(event) => updateSchedule("everyNDays", event.target.value)} type="number" value={schedule.everyNDays} /></label> : null}
          <label className="text-sm font-bold">Claim opens after (days)<input className={inputClass} disabled={!canManage || Boolean(busyAction)} min="1" onChange={(event) => updateSchedule("claimOpenAfterDays", event.target.value)} type="number" value={schedule.claimOpenAfterDays} /></label>
          <label className="text-sm font-bold">Claim window (days)<input className={inputClass} disabled={!canManage || Boolean(busyAction)} min="1" onChange={(event) => updateSchedule("claimWindowDays", event.target.value)} type="number" value={schedule.claimWindowDays} /></label>
        </div>
        <label className="block text-sm font-bold">Schedule version notes<input className={inputClass} disabled={!canManage || Boolean(busyAction)} maxLength={1000} onChange={(event) => updateSchedule("notes", event.target.value)} value={schedule.notes} /></label>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-2xl border border-[var(--color-border)] px-5 py-3 text-sm font-black disabled:opacity-50" disabled={!canManage || Boolean(busyAction)} onClick={previewSchedule} type="button">{busyAction === "preview" ? "Calculating…" : "Preview calendar"}</button>
          <button className="rounded-2xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-black text-white disabled:opacity-50" disabled={!canManage || Boolean(busyAction)} type="submit">{busyAction === "schedule" ? "Saving…" : "Save new schedule version"}</button>
          {!configuration?.rateVersions?.length && !configuration?.scheduleVersions?.length ? (
            <button className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50" disabled={!canManage || Boolean(busyAction)} onClick={initializeFromSavedRules} type="button">{busyAction === "initialize" ? "Initializing..." : "Initialize from saved rates + this schedule"}</button>
          ) : null}
        </div>
      </form>

      {preview.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {preview.map((period) => (
            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4" key={period.periodCode}>
              <p className="font-black">{dateLabel(period.startDate)} – {dateLabel(period.endDate)}</p>
              <p className="mt-2 text-xs text-[var(--color-muted)]">Cutoff: {dateLabel(period.cutoffDate)}</p>
              <p className="mt-1 text-xs font-bold text-[var(--color-maroon)]">Claim: {dateLabel(period.claimOpenDate)} – {dateLabel(period.claimCloseDate)}</p>
            </article>
          ))}
        </div>
      ) : null}

      {manualVersions.length ? (
        <form className="mt-7 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-4" onSubmit={saveManualCycle}>
          <h3 className="font-black text-[var(--color-text-strong)]">Create a custom earning period</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
            Manual schedules become usable only after a dated period is saved. Claim dates are calculated by the backend from that version.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-bold">
              Manual schedule version
              <select
                className={inputClass}
                disabled={!canManage || Boolean(busyAction)}
                onChange={(event) => setManualCycle((current) => ({ ...current, scheduleVersionId: event.target.value }))}
                value={manualCycle.scheduleVersionId}
              >
                {manualVersions.map((version) => (
                  <option key={version.id} value={version.id}>
                    Effective {dateLabel(version.effectiveFrom)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Period start
              <input className={inputClass} disabled={!canManage || Boolean(busyAction)} onChange={(event) => setManualCycle((current) => ({ ...current, startDate: event.target.value }))} type="date" value={manualCycle.startDate} />
            </label>
            <label className="text-sm font-bold">
              Period end / cutoff
              <input className={inputClass} disabled={!canManage || Boolean(busyAction)} onChange={(event) => setManualCycle((current) => ({ ...current, endDate: event.target.value }))} type="date" value={manualCycle.endDate} />
            </label>
          </div>
          <button className="mt-4 rounded-2xl bg-[var(--color-maroon)] px-5 py-3 text-sm font-black text-white disabled:opacity-50" disabled={!canManage || Boolean(busyAction)} type="submit">
            {busyAction === "manual-cycle" ? "Saving…" : "Save manual period"}
          </button>
        </form>
      ) : null}

      {configuration?.rateVersions?.length || configuration?.scheduleVersions?.length ? (
        <details className="mt-7 rounded-2xl border border-[var(--color-border)] p-4">
          <summary className="cursor-pointer font-black">Immutable version history</summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div><p className="text-sm font-black">Rate versions</p>{configuration.rateVersions.map((version) => <p className="mt-2 text-xs text-[var(--color-muted)]" key={version.id}>{dateLabel(version.effectiveFrom)} · {version.notes || "No notes"}</p>)}</div>
            <div><p className="text-sm font-black">Schedule versions</p>{configuration.scheduleVersions.map((version) => <p className="mt-2 text-xs text-[var(--color-muted)]" key={version.id}>{dateLabel(version.effectiveFrom)} · {version.scheduleType.replaceAll("_", " ")} · {version.notes || "No notes"}</p>)}</div>
          </div>
        </details>
      ) : null}
    </Card>
  )
}
