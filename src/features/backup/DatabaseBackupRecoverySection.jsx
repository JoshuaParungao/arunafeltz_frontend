import { useEffect, useState, useRef } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Download,
  HardDriveDownload,
  LoaderCircle,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from "lucide-react"

import Badge from "../../components/ui/Badge"
import Card from "../../components/ui/Card"
import {
  downloadScheduledBackup,
  exportDatabaseBackup,
  getScheduledBackups,
  restoreDatabaseBackup,
} from "./backup.api"

export default function DatabaseBackupRecoverySection({ user }) {
  const [scheduledBackups, setScheduledBackups] = useState([])
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState("")

  // Restore state
  const [selectedFile, setSelectedFile] = useState(null)
  const [parsedBackup, setParsedBackup] = useState(null)
  const [parseError, setParseError] = useState("")
  const [password, setPassword] = useState("")
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState("")
  const [restoreError, setRestoreError] = useState("")
  const [restoreSummary, setRestoreSummary] = useState(null)
  const fileInputRef = useRef(null)

  const allowedRoles = new Set(["SUPER_OWNER", "BRANCH_OWNER", "ADMIN"])
  const canAccess = user && allowedRoles.has(user.role)

  const loadScheduledList = async () => {
    setIsLoadingScheduled(true)
    try {
      const response = await getScheduledBackups()
      if (response?.success && Array.isArray(response?.data)) {
        setScheduledBackups(response.data)
      } else {
        setScheduledBackups([])
      }
    } catch {
      setScheduledBackups([])
    } finally {
      setIsLoadingScheduled(false)
    }
  }

  useEffect(() => {
    if (canAccess) {
      loadScheduledList()
    }
  }, [canAccess])

  if (!canAccess) {
    return null
  }

  const triggerBlobDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(new Blob([blob], { type: "application/json" }))
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", filename)
    document.body.appendChild(link)
    link.click()
    link.parentNode.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const handleManualExport = async () => {
    setIsExporting(true)
    setExportMessage("")
    try {
      const blob = await exportDatabaseBackup()
      const now = new Date()
      const manilaString = now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
      const manila = new Date(manilaString)
      const yyyy = manila.getFullYear()
      const mm = String(manila.getMonth() + 1).padStart(2, "0")
      const dd = String(manila.getDate()).padStart(2, "0")
      const hh = String(manila.getHours()).padStart(2, "0")
      const min = String(manila.getMinutes()).padStart(2, "0")
      const ss = String(manila.getSeconds()).padStart(2, "0")
      const filename = `arunafeltz-backup-${yyyy}${mm}${dd}-${hh}${min}${ss}.json`

      triggerBlobDownload(blob, filename)
      setExportMessage("Manual backup successfully generated and downloaded.")
      loadScheduledList()
    } catch (err) {
      setExportMessage(
        err?.response?.data?.message || err?.message || "Failed to download database backup."
      )
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadScheduled = async (filename) => {
    try {
      const blob = await downloadScheduledBackup(filename)
      triggerBlobDownload(blob, filename)
    } catch (err) {
      alert(
        err?.response?.data?.message || err?.message || "Failed to download scheduled backup file."
      )
    }
  }

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    setParseError("")
    setRestoreError("")
    setRestoreMessage("")
    setRestoreSummary(null)

    if (!file) {
      setSelectedFile(null)
      setParsedBackup(null)
      return
    }

    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result)
        if (!json.data || typeof json.data !== "object") {
          throw new Error("File is not a valid Arunafeltz database backup format.")
        }
        setParsedBackup(json)
      } catch (err) {
        setParseError(`Invalid backup file: ${err.message}`)
        setParsedBackup(null)
      }
    }
    reader.onerror = () => {
      setParseError("Could not read the uploaded file.")
      setParsedBackup(null)
    }
    reader.readAsText(file)
  }

  const handleRestore = async (event) => {
    event.preventDefault()
    if (!parsedBackup) {
      setRestoreError("Please upload a valid backup JSON file.")
      return
    }

    if (!password.trim()) {
      setRestoreError("Please enter your account password to confirm restore.")
      return
    }

    if (
      !window.confirm(
        "CRITICAL WARNING: Restoring will overwrite system database tables with the contents of this backup file. Are you absolutely sure you want to proceed?"
      )
    ) {
      return
    }

    setIsRestoring(true)
    setRestoreError("")
    setRestoreMessage("")
    setRestoreSummary(null)

    try {
      const response = await restoreDatabaseBackup({
        password: password.trim(),
        backupData: parsedBackup,
      })

      if (response?.success) {
        setRestoreMessage("Database restored successfully!")
        setRestoreSummary(response.data?.restoredCounts || {})
        setPassword("")
        setSelectedFile(null)
        setParsedBackup(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      } else {
        throw new Error(response?.message || "Database restore failed.")
      }
    } catch (err) {
      setRestoreError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to restore database."
      )
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-sidebar)] p-6 text-white shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-white shadow-soft">
              <Database size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone="maroon">Disaster Recovery & Data Protection</Badge>
                <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-black text-emerald-300">
                  Daily 11:00 AM & 6:00 PM (PHT)
                </span>
              </div>
              <h2 className="mt-2 text-xl font-bold">Database Backup & Disaster Recovery</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/75">
                Download manual snapshots, inspect automatic 11:00 AM & 6:00 PM Philippine Time
                scheduled backups, and restore data safely if corruption occurs.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[var(--color-sidebar)] shadow-soft transition hover:bg-slate-100 disabled:opacity-50"
              disabled={isExporting}
              onClick={handleManualExport}
              type="button"
            >
              {isExporting ? (
                <>
                  <LoaderCircle className="animate-spin" size={18} />
                  Generating backup…
                </>
              ) : (
                <>
                  <Download size={18} />
                  Download Backup Now
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {exportMessage ? (
        <div
          className={`rounded-2xl p-4 text-sm font-semibold ${
            exportMessage.includes("successfully")
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {exportMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scheduled Backups List */}
        <Card className="flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
            <div className="flex items-center gap-2.5">
              <Clock className="text-[var(--color-maroon)]" size={20} />
              <div>
                <h3 className="font-bold text-[var(--color-text-strong)]">Scheduled Auto-Backups</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Captured at 11:00 AM & 6:00 PM (Asia/Manila PHT)
                </p>
              </div>
            </div>
            <button
              className="rounded-xl border border-[var(--color-border)] p-2 text-[var(--color-muted)] transition hover:bg-[var(--color-soft)]"
              onClick={loadScheduledList}
              title="Refresh list"
              type="button"
            >
              <RefreshCw className={isLoadingScheduled ? "animate-spin" : ""} size={16} />
            </button>
          </div>

          <div className="mt-4 flex-1">
            {isLoadingScheduled ? (
              <div className="flex items-center gap-2 p-6 text-sm text-[var(--color-muted)]">
                <LoaderCircle className="animate-spin" size={18} />
                Loading scheduled backup history…
              </div>
            ) : scheduledBackups.length === 0 ? (
              <div className="grid place-items-center p-8 text-center text-sm text-[var(--color-muted)]">
                <HardDriveDownload size={36} className="text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No scheduled backup files yet</p>
                <p className="text-xs mt-1 text-slate-500">
                  The automated scheduler will capture snapshots daily at 11:00 AM & 6:00 PM PHT.
                </p>
              </div>
            ) : (
              <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                {scheduledBackups.map((item) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-soft)] p-3.5 transition hover:border-[var(--color-maroon)]"
                    key={item.filename}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[var(--color-text-strong)]">
                        {item.filename}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                        {new Date(item.createdAt).toLocaleString("en-US", {
                          timeZone: "Asia/Manila",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}{" "}
                        · {item.sizeFormatted}
                      </p>
                    </div>
                    <button
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white border border-[var(--color-border)] px-3 py-1.5 text-xs font-bold text-[var(--color-maroon)] shadow-xs transition hover:bg-slate-50"
                      onClick={() => handleDownloadScheduled(item.filename)}
                      type="button"
                    >
                      <Download size={14} /> Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Restore from Backup Card */}
        <Card className="flex flex-col border-amber-200 ring-1 ring-amber-200/50">
          <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] pb-4">
            <ShieldAlert className="text-amber-600" size={20} />
            <div>
              <h3 className="font-bold text-[var(--color-text-strong)]">
                Restore Database from Backup
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                Upload snapshot file to recover damaged or lost records
              </p>
            </div>
          </div>

          <form className="mt-4 space-y-4 flex-1 flex flex-col justify-between" onSubmit={handleRestore}>
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">
                  Select Backup JSON File
                </span>
                <input
                  accept=".json"
                  className="mt-2 block w-full text-xs text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--color-maroon)] file:px-4 file:py-2.5 file:text-xs file:font-bold file:text-white hover:file:bg-[var(--color-maroon-hover)] file:cursor-pointer"
                  disabled={isRestoring}
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  type="file"
                />
              </label>

              {parseError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  {parseError}
                </div>
              ) : null}

              {parsedBackup ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                    <CheckCircle2 size={14} /> Valid Backup Snapshot
                  </div>
                  <p className="text-slate-600">
                    <strong>Exported Date:</strong>{" "}
                    {parsedBackup.exportedAt
                      ? new Date(parsedBackup.exportedAt).toLocaleString("en-US", {
                          timeZone: "Asia/Manila",
                        })
                      : "Unknown"}
                  </p>
                  <p className="text-slate-600">
                    <strong>Total Records:</strong>{" "}
                    {parsedBackup.metadata?.totalRecords?.toLocaleString() || "N/A"}
                  </p>
                  <p className="text-slate-600 truncate">
                    <strong>Checksum (SHA-256):</strong> {parsedBackup.checksum || "N/A"}
                  </p>
                </div>
              ) : null}

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)] flex items-center gap-1">
                  <Lock size={12} /> Account Password Confirmation
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 text-sm outline-none transition focus:border-[var(--color-maroon)] disabled:bg-[var(--color-soft)]"
                  disabled={isRestoring || !parsedBackup}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your current password to authorize restore"
                  type="password"
                  value={password}
                />
              </label>

              {restoreError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 flex items-start gap-2">
                  <AlertTriangle className="shrink-0 mt-0.5" size={14} />
                  <span>{restoreError}</span>
                </div>
              ) : null}

              {restoreMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck size={16} /> {restoreMessage}
                  </div>
                  {restoreSummary ? (
                    <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] font-normal text-emerald-900 max-h-32 overflow-y-auto">
                      {Object.entries(restoreSummary).map(([tbl, count]) => (
                        <span key={tbl}>
                          {tbl}: <strong>{count}</strong>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="pt-2">
              <button
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-red-800 disabled:opacity-50"
                disabled={isRestoring || !parsedBackup || !password.trim()}
                type="submit"
              >
                {isRestoring ? (
                  <>
                    <LoaderCircle className="animate-spin" size={18} />
                    Restoring database atomically…
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Confirm & Restore Database
                  </>
                )}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
