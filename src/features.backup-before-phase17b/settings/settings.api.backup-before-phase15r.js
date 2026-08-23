import apiClient from "../../lib/apiClient"

export async function getSettings() {
  const response = await apiClient.get("/settings")
  return response.data
}
