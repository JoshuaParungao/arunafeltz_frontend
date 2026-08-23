import apiClient from "../../lib/apiClient"

export async function getSales(params = {}) {
  const response = await apiClient.get("/sales", { params })
  return response.data
}

export async function getSaleById(id) {
  const response = await apiClient.get(`/sales/${id}`)
  return response.data
}

export async function createSale(payload) {
  const response = await apiClient.post("/sales", payload)
  return response.data
}

export async function createSaleCreditAccount(id, payload) {
  const response = await apiClient.post(`/sales/${id}/credit-account`, payload)
  return response.data
}

export async function cancelSale(id, payload) {
  const response = await apiClient.patch(`/sales/${id}/cancel`, payload)
  return response.data
}

export async function createSaleReturn(id, payload) {
  const response = await apiClient.post(`/sales/${id}/returns`, payload)
  return response.data
}
