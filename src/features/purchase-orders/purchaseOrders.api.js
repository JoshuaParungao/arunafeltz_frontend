import apiClient from "../../lib/apiClient"

export async function getPurchaseOrders(params = {}) {
  const response = await apiClient.get("/purchase-orders", { params })
  return response.data
}

export async function getPurchaseOrderById(id) {
  const response = await apiClient.get(`/purchase-orders/${id}`)
  return response.data
}

export async function createPurchaseOrder(payload) {
  const response = await apiClient.post("/purchase-orders", payload)
  return response.data
}

export async function updatePurchaseOrder(id, payload) {
  const response = await apiClient.patch(`/purchase-orders/${id}`, payload)
  return response.data
}

export async function updatePurchaseOrderStatus(id, payload) {
  const response = await apiClient.patch(`/purchase-orders/${id}/status`, payload)
  return response.data
}
