import apiClient from "../../lib/apiClient"

export async function getSettings() {
  const response = await apiClient.get("/settings")
  return response.data
}

export async function updateSettingByScopeKey(scopeKey, payload) {
  const cleanKey = String(scopeKey || "").replace(/^GLOBAL:/i, "").trim()
  const requestBody = {
    key: cleanKey,
    scopeKey: scopeKey || `GLOBAL:${cleanKey}`,
    ...payload,
  }

  try {
    const response = await apiClient.patch("/settings", requestBody)
    return response.data
  } catch (error) {
    if (error?.response?.status === 404) {
      const fallbackResponse = await apiClient.patch(`/settings/scope/${cleanKey}`, payload)
      return fallbackResponse.data
    }
    throw error
  }
}
