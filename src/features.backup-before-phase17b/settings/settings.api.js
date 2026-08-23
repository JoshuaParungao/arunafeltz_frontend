import apiClient from "../../lib/apiClient"

export async function getSettings() {
  const response = await apiClient.get("/settings")
  return response.data
}

export async function updateSettingByScopeKey(scopeKey, payload) {
  const encodedScopeKey = encodeURIComponent(scopeKey)
  const response = await apiClient.patch(`/settings/scope/${encodedScopeKey}`, payload)
  return response.data
}
