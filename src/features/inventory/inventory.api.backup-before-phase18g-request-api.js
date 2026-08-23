import apiClient from "../../lib/apiClient"

export async function getInventoryOverview(params = {}) {
  const response = await apiClient.get("/inventory/overview", { params })
  return response.data
}
