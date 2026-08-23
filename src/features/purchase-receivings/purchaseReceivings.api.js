import apiClient from "../../lib/apiClient"

export async function getPurchaseReceivings(params = {}) {
  const response = await apiClient.get("/purchase-receivings", { params })
  return response.data
}

export async function getPurchaseReceivingById(id) {
  const response = await apiClient.get(`/purchase-receivings/${id}`)
  return response.data
}

export async function createPurchaseReceiving(payload) {
  const response = await apiClient.post("/purchase-receivings", payload)
  return response.data
}

export async function updatePurchaseReceiving(id, payload) {
  const response = await apiClient.patch(`/purchase-receivings/${id}`, payload)
  return response.data
}

export async function updatePurchaseReceivingStatus(id, payload) {
  const response = await apiClient.patch(`/purchase-receivings/${id}/status`, payload)
  return response.data
}
