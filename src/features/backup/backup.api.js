import apiClient from "../../lib/apiClient"

export const getScheduledBackups = async () => {
  const response = await apiClient.get("/backups/scheduled")
  return response.data
}

export const exportDatabaseBackup = async () => {
  const response = await apiClient.get("/backups/export", {
    responseType: "blob",
    timeout: 120000,
  })
  return response.data
}

export const downloadScheduledBackup = async (filename) => {
  const response = await apiClient.get(
    `/backups/scheduled/${encodeURIComponent(filename)}`,
    {
      responseType: "blob",
      timeout: 120000,
    }
  )
  return response.data
}

export const restoreDatabaseBackup = async (payload) => {
  const response = await apiClient.post("/backups/restore", payload, {
    timeout: 120000,
  })
  return response.data
}
