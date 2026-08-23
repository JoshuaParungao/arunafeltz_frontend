import apiClient from "../../lib/apiClient"

export async function getInventoryOverview(params = {}) {
  const response = await apiClient.get("/inventory/overview", { params })
  return response.data
}

export async function createStockTransferRequest(payload) {
  const response = await apiClient.post("/stock-transfers/requests", payload)
  return response.data
}
