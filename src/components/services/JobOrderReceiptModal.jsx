import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { AlertCircle, LoaderCircle, Printer } from "lucide-react"
import { getServiceJobById } from "../../features/service-jobs/serviceJobs.api"
import JobOrderReceiptPrint from "../../pages/services/JobOrderReceiptPrint"

export default function JobOrderReceiptModal({
  job: initialJob,
  jobId,
  onClose,
}) {
  const [job, setJob] = useState(initialJob || null)
  const [isLoading, setIsLoading] = useState(!initialJob && Boolean(jobId))
  const [errorMessage, setErrorMessage] = useState("")

  const targetJobId = jobId || initialJob?.id

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!initialJob || (!initialJob.assignedTechnician && !initialJob.serviceDoneBy && targetJobId)) {
      if (targetJobId) {
        let active = true
        setIsLoading(true)
        getServiceJobById(targetJobId)
          .then((res) => {
            if (active) {
              setJob(res?.data || initialJob)
            }
          })
          .catch((err) => {
            if (active) {
              setErrorMessage(err?.response?.data?.message || err?.message || "Failed to load job order receipt.")
            }
          })
          .finally(() => {
            if (active) setIsLoading(false)
          })
        return () => {
          active = false
        }
      }
    } else {
      setJob(initialJob)
    }
  }, [initialJob, targetJobId])

  const activeJob = job || {}
  const subTitle = `JO #${activeJob?.jobCode || "—"} · Official Service Receipt (A4 Ready)`

  return createPortal(
    <div aria-label="Printable job order" aria-modal="true" className="job-order-print-overlay" role="dialog">
      <div className="job-order-print-shell">
        <div className="job-order-print-actions">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="font-black text-white">Official Job Order Receipt</p>
              <p className="text-xs text-white/70">{subTitle}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-xl border border-white/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-[var(--color-maroon)] shadow-lg hover:bg-slate-50"
              onClick={() => window.print()}
              type="button"
            >
              <Printer size={16} /> Print A4 / Save PDF
            </button>
          </div>
        </div>

        <article className="job-order-print-document">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-sm font-semibold text-slate-500">
              <LoaderCircle className="animate-spin" size={20} />
              Loading complete service job order receipt…
            </div>
          ) : errorMessage ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 m-6">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <span>{errorMessage}</span>
            </div>
          ) : (
            <JobOrderReceiptPrint isBlank={false} job={activeJob} />
          )}
        </article>
      </div>
    </div>,
    document.body
  )
}
