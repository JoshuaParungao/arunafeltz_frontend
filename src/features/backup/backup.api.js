import apiClient from "../../lib/apiClient"

export const getScheduledBackups = async () => {
  const response = await apiClient.get("/backups/scheduled")
  return response.data
}

export const exportDatabaseBackup = async () => {
  const response = await apiClient.get("/backups/export", {
    responseType: "blob",
  })
  return response.data
}

export const downloadScheduledBackup = async (filename) => {
  const response = await apiClient.get(
    `/backups/scheduled/${encodeURIComponent(filename)}`,
    {
      responseType: "blob",
    }
  )
  return response.data
}

export const restoreDatabaseBackup = async (payload) => {
  const response = await apiClient.post("/backups/restore", payload)
  return response.data
}
