import apiClient from "../../lib/apiClient"

export async function getAuditLogs(params = {}) {
  const response = await apiClient.get("/audit-logs", { params })
  return response.data
}

export async function getAuditLogById(id) {
  const response = await apiClient.get(`/audit-logs/${id}`)
  return response.data
}
